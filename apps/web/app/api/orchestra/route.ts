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
type OrchestraResponse = { turns: SwarmTurn[]; verification: Verdict; artifact_content: string };

// Fixed weight for a verified artifact (outline §8: highest-weight contribution type).
const ARTIFACT_VERIFIED_POV_DELTA = 10;

// Auth + quota gate, then proxy from the browser to the orchestra (FastAPI/LangGraph)
// swarm service, persisting both the Director's turn and each agent's turn to pod_turns.
export async function POST(request: NextRequest) {
  const { director_prompt: directorPrompt, pod_id: podId } = await request.json();
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

  // Anti-gaming: block only questions that have ALREADY been verified in this pod,
  // so PoV can't be farmed twice for the same win. A question that previously failed
  // verification can be retried freely — theories are allowed to evolve, not just win once.
  // Checked before the quota spend so a blocked repeat doesn't cost a free prompt.
  const normalizedPrompt = directorPrompt.trim().toLowerCase();
  const { data: priorVerifiedArtifacts } = await supabase
    .from('artifacts')
    .select('question')
    .eq('pod_id', podId)
    .eq('is_verified', true);

  const alreadyVerified = priorVerifiedArtifacts?.some(
    (a) => a.question?.trim().toLowerCase() === normalizedPrompt
  );
  if (alreadyVerified) {
    return NextResponse.json(
      {
        error: 'duplicate_question',
        detail:
          'This exact question already has a verified artifact in this pod. Ask something new to contribute — re-running a won question earns no additional Proof-of-Value.',
      },
      { status: 409 }
    );
  }

  // SECURITY DEFINER function enforces the 5/day free-tier ceiling atomically.
  const { error: quotaError } = await supabase.rpc('increment_daily_usage');
  if (quotaError) {
    return NextResponse.json({ error: 'daily_prompt_limit_exceeded' }, { status: 429 });
  }

  const { count } = await supabase
    .from('pod_turns')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', podId);
  const nextSequence = (count ?? 0) + 1;

  // Director's own turn: RLS requires sender_id = auth.uid(), so the user's session
  // client (not the admin client) performs this insert.
  const { error: directorTurnError } = await supabase.from('pod_turns').insert({
    pod_id: podId,
    sender_id: user.id,
    summary_conclusion: directorPrompt,
    turn_sequence: nextSequence,
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
    body: JSON.stringify({ director_prompt: directorPrompt }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: 'orchestra_unavailable', detail }, { status: 502 });
  }

  const { turns, verification, artifact_content: artifactContent } =
    (await response.json()) as OrchestraResponse;

  // Agent turns: sender_id is a native-agent profile, not the human, so RLS would
  // reject a user-session insert here — this is exactly what the admin client is for.
  const admin = createAdminClient();
  const { data: insertedTurns, error: agentTurnsError } = await admin
    .from('pod_turns')
    .insert(
      turns.map((turn, i) => ({
        pod_id: podId,
        sender_id: AGENT_PROFILE_ID_BY_NAME[turn.agent],
        summary_conclusion: turn.summary_conclusion,
        turn_sequence: nextSequence + i + 1,
      }))
    )
    .select('id, sender_id');
  if (agentTurnsError) {
    return NextResponse.json(
      { error: 'agent_turn_insert_failed', detail: agentTurnsError.message },
      { status: 500 }
    );
  }

  // Persist @Synthetix's construction as an artifact, scored/verified only from
  // @Veritas's own parsed verdict — the client never sets is_verified itself.
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

  // PoV is only ever awarded here, gated strictly on @Veritas's own eligibility flag.
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

  return NextResponse.json({ turns, verification });
}
