import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_PROFILE_IDS, ORIENTATION_POD_ID } from '@/lib/constants';
import OrientationPod, { type SwarmTurn } from './orientation-pod';
import PublicHome from './public-home';
import { dailyLimitForRole } from '@/lib/tiers';

const TURNS_PER_CYCLE = 5;

const AGENT_ID_SET: Set<string> = new Set(Object.values(AGENT_PROFILE_IDS));

function parseDirectorMeta(raw: string | null | undefined): {
  directorNote: string | null;
  referenceUrl: string | null;
  attachmentName: string | null;
} {
  if (!raw?.trim()) return { directorNote: null, referenceUrl: null, attachmentName: null };
  let directorNote: string | null = null;
  let referenceUrl: string | null = null;
  let attachmentName: string | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('NOTE:')) directorNote = line.slice(5).trim() || null;
    if (line.startsWith('REF:')) referenceUrl = line.slice(4).trim() || null;
    if (line.startsWith('ATTACHMENT:')) attachmentName = line.slice(11).trim() || null;
  }
  return { directorNote, referenceUrl, attachmentName };
}

async function importLegacyTurns(admin: ReturnType<typeof createAdminClient>, userId: string, podId: string) {
  const { count: privateTurnCount } = await admin
    .from('pod_turns')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', podId);
  if ((privateTurnCount ?? 0) === 0) {
    const { data: legacyTurns } = await admin
      .from('pod_turns')
      .select('id, sender_id, summary_conclusion, collapsed_reasoning, turn_sequence, created_at, sender_label')
      .eq('pod_id', ORIENTATION_POD_ID)
      .order('turn_sequence', { ascending: true });
    if (legacyTurns?.length) {
      const userTurnIndexes = legacyTurns
        .map((turn, index) => (turn.sender_id === userId ? index : -1))
        .filter((index) => index >= 0);
      const selectedTurns = userTurnIndexes.flatMap((start, index) =>
        legacyTurns.slice(start, userTurnIndexes[index + 1] ?? legacyTurns.length)
      );
      if (selectedTurns.length) {
        const { data: copiedTurns } = await admin
          .from('pod_turns')
          .insert(
            selectedTurns.map((turn, index) => ({
              pod_id: podId,
              sender_id: turn.sender_id,
              summary_conclusion: turn.summary_conclusion,
              collapsed_reasoning: turn.collapsed_reasoning,
              turn_sequence: index + 1,
              created_at: turn.created_at,
              sender_label: turn.sender_label,
            }))
          )
          .select('id, turn_sequence');
        if (copiedTurns) {
          const legacyIds = selectedTurns.map((turn) => turn.id);
          const { data: legacyArtifacts } = await admin
            .from('artifacts')
            .select('turn_id, creator_id, type, content, veritas_score, is_verified, question, created_at')
            .in('turn_id', legacyIds);
          const copiedIdBySequence = new Map(copiedTurns.map((turn) => [turn.turn_sequence, turn.id]));
          const sequenceByLegacyId = new Map(selectedTurns.map((turn, index) => [turn.id, index + 1]));
          if (legacyArtifacts?.length) {
            await admin.from('artifacts').insert(
              legacyArtifacts
                .map((artifact) => ({
                  ...artifact,
                  pod_id: podId,
                  turn_id: copiedIdBySequence.get(sequenceByLegacyId.get(artifact.turn_id!) ?? -1),
                }))
                .filter((artifact) => artifact.turn_id)
            );
          }
        }
      }
    }
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { pod?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <PublicHome />;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const requestedPodId = searchParams?.pod;

  let pod: {
    id: string;
    name: string;
    rolling_summary: string;
  } | null = null;

  if (requestedPodId) {
    const { data: access } = await supabase
      .from('private_pod_permissions')
      .select('can_direct')
      .eq('pod_id', requestedPodId)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (access) {
      const { data: requested } = await admin
        .from('mini_pods')
        .select('id, name, rolling_summary')
        .eq('id', requestedPodId)
        .maybeSingle();
      pod = requested;
    }
  }

  if (!pod) {
    const { data: owned } = await admin
      .from('mini_pods')
      .select('id, name, rolling_summary')
      .eq('created_by', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    pod = owned;
  }

  if (!pod) {
    const { data: created } = await admin
      .from('mini_pods')
      .insert({
        name: 'Orientation',
        category_slug: 'science',
        created_by: user.id,
        rolling_summary: 'Initial context baseline setting up…',
        status: 'active',
      })
      .select('id, name, rolling_summary')
      .single();
    pod = created;
    if (pod) {
      await admin.from('private_pod_permissions').insert({
        pod_id: pod.id,
        profile_id: user.id,
        can_direct: true,
      });
      await importLegacyTurns(admin, user.id, pod.id);
    }
  }

  if (!pod) {
    return <PublicHome />;
  }

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: user.id,
      display_name: user.email?.split('@')[0] ?? 'Director',
      role: 'free_public',
    });
  }

  const directorLabel =
    existingProfile?.display_name || user.email?.split('@')[0] || 'Director';
  const memberRole = existingProfile?.role ?? 'free_public';
  const dailyLimit = dailyLimitForRole(memberRole);

  const [{ data: usage }, { data: history }] = await Promise.all([
    supabase
      .from('daily_usage_logs')
      .select('prompt_count')
      .eq('profile_id', user.id)
      .eq('usage_date', today)
      .maybeSingle(),
    admin
      .from('pod_turns')
      .select(
        'summary_conclusion, turn_sequence, sender_id, sender_label, collapsed_reasoning, sender:profiles!pod_turns_sender_id_fkey(display_name)'
      )
      .eq('pod_id', pod.id)
      .order('turn_sequence', { ascending: true })
      .limit(200),
  ]);

  const remainingPrompts = Math.max(dailyLimit - (usage?.prompt_count ?? 0), 0);

  type HistoryRow = {
    summary_conclusion: string;
    turn_sequence: number;
    sender_id: string;
    sender_label: string | null;
    collapsed_reasoning: string | null;
    sender: { display_name: string } | null;
  };

  const rows = (history ?? []) as unknown as HistoryRow[];

  const initialCycles: {
    question: string;
    directorLabel: string;
    turns: SwarmTurn[];
    directorNote: string | null;
    referenceUrl: string | null;
    attachmentName: string | null;
  }[] = [];

  for (let i = 0; i < rows.length; i += TURNS_PER_CYCLE) {
    const chunk = rows.slice(i, i + TURNS_PER_CYCLE);
    const director = chunk[0];
    if (!director) continue;
    const isAgentDirector = AGENT_ID_SET.has(director.sender_id);
    const label = isAgentDirector
      ? 'Director'
      : director.sender_label || director.sender?.display_name || 'Director';
    const meta = parseDirectorMeta(director.collapsed_reasoning);
    const agentTurns: SwarmTurn[] = chunk.slice(1).map((turn) => ({
      agent: turn.sender_label || turn.sender?.display_name || 'Contributor',
      summary_conclusion: turn.summary_conclusion,
    }));
    initialCycles.push({
      question: director.summary_conclusion,
      directorLabel: label,
      turns: agentTurns,
      directorNote: meta.directorNote,
      referenceUrl: meta.referenceUrl,
      attachmentName: meta.attachmentName,
    });
  }
  initialCycles.reverse();

  return (
    <OrientationPod
      podId={pod.id}
      podName={pod.name}
      podSummary={pod.rolling_summary}
      initialRemainingPrompts={remainingPrompts}
      initialCycles={initialCycles}
      userEmail={user.email ?? ''}
      currentDirectorLabel={directorLabel}
    />
  );
}
