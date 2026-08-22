import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_PROFILE_ID_BY_NAME, AGENT_PROFILE_IDS } from '@/lib/constants';

type SwarmTurn = { agent: string; summary_conclusion: string };
type Verdict = {
  verdict: string;
  score: number | null;
  failure_modes: string[];
  pov_eligible: boolean;
};
type OrchestraResponse = {
  turns: SwarmTurn[];
  verification: Verdict;
  artifact_content: string;
  mode?: string;
};

const ARTIFACT_VERIFIED_POV_DELTA = 10;
const MAX_ATTACHMENT_CHARS = 12000;

function buildRollingSummary(
  directorPrompt: string,
  verification: Verdict,
  mode?: string
): string {
  const clipped =
    directorPrompt.length > 110 ? `${directorPrompt.slice(0, 107).trim()}…` : directorPrompt.trim();
  const modeLabel = mode ? `${mode} · ` : '';
  if (verification.pov_eligible) {
    return `${modeLabel}Latest: “${clipped}” — verified · ${verification.score ?? '—'}/100`;
  }
  if (typeof verification.score === 'number' && verification.score >= 70) {
    return `${modeLabel}Latest: “${clipped}” — strong progress · ${verification.score}/100`;
  }
  if (typeof verification.score === 'number') {
    return `${modeLabel}Latest: “${clipped}” — ${verification.score}/100 · not yet verified`;
  }
  return `${modeLabel}Latest: “${clipped}”`;
}

function sanitizeReferenceUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function sanitizeAttachment(
  nameRaw: unknown,
  textRaw: unknown
): { name: string; text: string } | null {
  if (typeof nameRaw !== 'string' || typeof textRaw !== 'string') return null;
  const name = nameRaw.trim().slice(0, 120);
  const text = textRaw.trim();
  if (!name || !text) return null;
  return {
    name: name.replace(/[^\w.\- ()\[\]]+/g, '_').slice(0, 120),
    text: text.slice(0, MAX_ATTACHMENT_CHARS),
  };
}

function buildDirectorMeta(
  note: string,
  referenceUrl: string | null,
  attachment: { name: string; text: string } | null
): string | null {
  const parts: string[] = [];
  if (note.trim()) parts.push(`NOTE: ${note.trim().slice(0, 800)}`);
  if (referenceUrl) parts.push(`REF: ${referenceUrl}`);
  if (attachment) {
    parts.push(`ATTACHMENT: ${attachment.name}`);
    parts.push('---attachment---');
    parts.push(attachment.text);
  }
  return parts.length ? parts.join('\n') : null;
}

function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const directorPrompt: string = body.director_prompt;
  const podId: string = body.pod_id;
  const priorContext: string = body.prior_context ?? '';
  const mode: string = body.mode ?? 'construct';
  const directorNote: string = typeof body.director_note === 'string' ? body.director_note : '';
  const referenceUrl = sanitizeReferenceUrl(body.reference_url);
  const attachment = sanitizeAttachment(body.attachment_name, body.attachment_text);

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!podId || typeof podId !== 'string') {
    return NextResponse.json({ error: 'pod_required' }, { status: 400 });
  }

  const { data: podAccess } = await supabase
    .from('private_pod_permissions')
    .select('can_direct')
    .eq('pod_id', podId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!podAccess?.can_direct) {
    return NextResponse.json({ error: 'pod_access_denied' }, { status: 403 });
  }

  const normalizedPrompt = normalizeQuestion(directorPrompt);
  if (!normalizedPrompt) {
    return NextResponse.json({ error: 'empty_prompt' }, { status: 400 });
  }

  // Integrity: once a question is verified, exact re-runs do not earn more PoV.
  // In-pod check (user-scoped) + ecosystem-wide check (admin) against verified artifacts.
  const { data: priorInPod } = await supabase
    .from('artifacts')
    .select('question, is_verified')
    .eq('pod_id', podId);

  const inPodVerified = priorInPod?.some(
    (a) => a.is_verified && normalizeQuestion(a.question ?? '') === normalizedPrompt
  );
  if (inPodVerified) {
    return NextResponse.json(
      {
        error: 'duplicate_question',
        detail:
          'This exact question already has a verified artifact in this pod. Continue the thread with a new angle, or start a clearly different question — re-running a won prompt earns no additional Proof-of-Value.',
      },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { data: globalVerified } = await admin
    .from('artifacts')
    .select('id, pod_id, question')
    .eq('is_verified', true)
    .limit(500);

  const ecosystemHit = globalVerified?.find(
    (a) => normalizeQuestion(a.question ?? '') === normalizedPrompt
  );
  if (ecosystemHit && ecosystemHit.pod_id !== podId) {
    return NextResponse.json(
      {
        error: 'duplicate_question',
        detail:
          'This exact question already has a verified result elsewhere in Brainpod. Copying a released prompt as-is does not advance the ledger. Refine it, attach new materials, or continue from your own thread.',
      },
      { status: 409 }
    );
  }

  const { error: quotaError } = await supabase.rpc('increment_daily_usage');
  if (quotaError) {
    return NextResponse.json({ error: 'daily_prompt_limit_exceeded' }, { status: 429 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const senderLabel =
    profile?.display_name?.trim() || user.email?.split('@')[0] || 'Director';

  const directorMeta = buildDirectorMeta(directorNote, referenceUrl, attachment);

  let enrichedContext = priorContext;
  if (directorMeta) {
    enrichedContext = enrichedContext
      ? `${enrichedContext}\n\n---\n\nDirector-supplied context:\n${directorMeta}`
      : `Director-supplied context:\n${directorMeta}`;
  }

  const { count } = await supabase
    .from('pod_turns')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', podId);
  const nextSequence = (count ?? 0) + 1;

  const { error: directorTurnError } = await admin.from('pod_turns').insert({
    pod_id: podId,
    sender_id: user.id,
    summary_conclusion: directorPrompt,
    turn_sequence: nextSequence,
    sender_label: senderLabel.slice(0, 40),
    collapsed_reasoning: directorMeta,
  });
  if (directorTurnError) {
    return NextResponse.json(
      { error: 'turn_insert_failed', detail: directorTurnError.message },
      { status: 500 }
    );
  }

  const orchestraUrl = process.env.ORCHESTRA_SERVICE_URL ?? 'http://localhost:8000';
  const response = await fetch(`${orchestraUrl}/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      director_prompt: directorPrompt,
      prior_context: enrichedContext || undefined,
      mode,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: 'orchestra_unavailable', detail }, { status: 502 });
  }

  const {
    turns,
    verification,
    artifact_content: artifactContent,
    mode: responseMode,
  } = (await response.json()) as OrchestraResponse;

  const effectiveMode = responseMode ?? mode;

  const { data: insertedTurns, error: agentTurnsError } = await admin
    .from('pod_turns')
    .insert(
      turns.map((turn, i) => ({
        pod_id: podId,
        sender_id: AGENT_PROFILE_ID_BY_NAME[turn.agent],
        summary_conclusion: turn.summary_conclusion,
        turn_sequence: nextSequence + i + 1,
        sender_label: turn.agent,
      }))
    )
    .select('id, sender_id');
  if (agentTurnsError) {
    return NextResponse.json(
      { error: 'agent_turn_insert_failed', detail: agentTurnsError.message },
      { status: 500 }
    );
  }

  const constructTurn = insertedTurns?.find((t) => t.sender_id === AGENT_PROFILE_IDS.synthetix);
  const { data: artifact, error: artifactError } = await admin
    .from('artifacts')
    .insert({
      pod_id: podId,
      turn_id: constructTurn?.id,
      creator_id: AGENT_PROFILE_IDS.synthetix,
      type: 'structured_analysis',
      content: artifactContent,
      question: directorPrompt,
      public_summary: null,
      veritas_score: verification.score,
      is_verified: verification.pov_eligible,
    })
    .select('id')
    .single();
  if (artifactError) {
    return NextResponse.json(
      { error: 'artifact_insert_failed', detail: artifactError.message },
      { status: 500 }
    );
  }

  if (verification.pov_eligible) {
    await admin.from('pov_ledger').insert({
      profile_id: AGENT_PROFILE_IDS.synthetix,
      pod_id: podId,
      artifact_id: artifact.id,
      delta: ARTIFACT_VERIFIED_POV_DELTA,
      reason_category: 'artifact_verified',
      action_reference_log: `verified via /api/orchestra, director turn_sequence=${nextSequence}`,
    });
  }

  const rollingSummary = buildRollingSummary(directorPrompt, verification, effectiveMode);
  await admin.from('mini_pods').update({ rolling_summary: rollingSummary }).eq('id', podId);

  return NextResponse.json({
    turns,
    verification,
    mode: effectiveMode,
    rolling_summary: rollingSummary,
    director_label: senderLabel,
    director_note: directorNote.trim().slice(0, 800) || null,
    reference_url: referenceUrl,
    attachment_name: attachment?.name ?? null,
  });
}
