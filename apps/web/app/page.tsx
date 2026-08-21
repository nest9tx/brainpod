import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_PROFILE_IDS, ORIENTATION_POD_ID } from '@/lib/constants';
import OrientationPod, { type SwarmTurn } from './orientation-pod';
import PublicHome from './public-home';

const FREE_TIER_DAILY_LIMIT = 5;
const TURNS_PER_CYCLE = 5;

const AGENT_ID_SET: Set<string> = new Set(Object.values(AGENT_PROFILE_IDS));

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
                  turn_id: copiedIdBySequence.get(sequenceByLegacyId.get(artifact.turn_id) ?? -1),
                }))
                .filter((artifact) => artifact.turn_id)
            );
          }
        }
      }
    }
  }

  await backfillStudyArtifacts(admin, podId);
}

async function backfillStudyArtifacts(admin: ReturnType<typeof createAdminClient>, podId: string) {
  const { data: turns } = await admin
    .from('pod_turns')
    .select('id, sender_id, summary_conclusion, turn_sequence')
    .eq('pod_id', podId)
    .order('turn_sequence', { ascending: true });
  if (!turns?.length) return;
  const { data: existing } = await admin.from('artifacts').select('turn_id').eq('pod_id', podId);
  const existingTurnIds = new Set(existing?.map((artifact) => artifact.turn_id) ?? []);
  const missing = [];
  for (let index = 0; index + 4 < turns.length; index += 5) {
    const cycle = turns.slice(index, index + 5);
    const director = cycle[0];
    const construct = cycle.find((turn) => turn.sender_id === AGENT_PROFILE_IDS.synthetix);
    if (director.sender_id === AGENT_PROFILE_IDS.synthetix || !construct || existingTurnIds.has(construct.id))
      continue;
    missing.push({
      pod_id: podId,
      turn_id: construct.id,
      creator_id: AGENT_PROFILE_IDS.synthetix,
      type: 'structured_analysis',
      content: construct.summary_conclusion,
      question: director.summary_conclusion,
      veritas_score: null,
      is_verified: false,
    });
  }
  if (missing.length) await admin.from('artifacts').insert(missing);
}

export default async function Home({ searchParams }: { searchParams: { pod?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <PublicHome />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  let pod: { id: string; name: string; rolling_summary: string } | null = null;

  if (searchParams.pod) {
    const { data: owned } = await supabase
      .from('mini_pods')
      .select('id, name, rolling_summary')
      .eq('id', searchParams.pod)
      .eq('created_by', user.id)
      .maybeSingle();
    if (owned) {
      pod = owned;
    } else {
      const { data: access } = await admin
        .from('private_pod_permissions')
        .select('pod_id')
        .eq('pod_id', searchParams.pod)
        .eq('profile_id', user.id)
        .maybeSingle();
      if (access) {
        const { data: shared } = await admin
          .from('mini_pods')
          .select('id, name, rolling_summary')
          .eq('id', searchParams.pod)
          .maybeSingle();
        if (shared) pod = shared;
      }
    }
  }

  if (!pod) {
    const { data: orientation } = await supabase
      .from('mini_pods')
      .select('id, name, rolling_summary')
      .eq('created_by', user.id)
      .eq('category_slug', 'orientation')
      .eq('status', 'private_isolated')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    pod = orientation;
  }

  if (!pod) {
    const { data: newPod, error: podError } = await admin
      .from('mini_pods')
      .insert({
        name: 'My Orientation Pod',
        category_slug: 'orientation',
        status: 'private_isolated',
        created_by: user.id,
      })
      .select('id, name, rolling_summary')
      .single();

    if (podError || !newPod) {
      throw new Error(`Could not create your private Orientation Pod: ${podError?.message ?? 'unknown error'}`);
    }

    const { error: permissionError } = await admin.from('private_pod_permissions').insert({
      pod_id: newPod.id,
      profile_id: user.id,
      can_direct: true,
    });
    if (permissionError) throw new Error(`Could not grant pod access: ${permissionError.message}`);
    pod = newPod;
  }

  await importLegacyTurns(admin, user.id, pod.id);

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: user.id,
      display_name: user.email?.split('@')[0] ?? 'Director',
    });
  }

  const directorLabel =
    existingProfile?.display_name || user.email?.split('@')[0] || 'Director';

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
        'summary_conclusion, turn_sequence, sender_id, sender_label, sender:profiles!pod_turns_sender_id_fkey(display_name)'
      )
      .eq('pod_id', pod.id)
      .order('turn_sequence', { ascending: true })
      .limit(200),
  ]);

  const remainingPrompts = Math.max(FREE_TIER_DAILY_LIMIT - (usage?.prompt_count ?? 0), 0);

  type HistoryRow = {
    summary_conclusion: string;
    turn_sequence: number;
    sender_id: string;
    sender_label: string | null;
    sender: { display_name: string } | null;
  };

  const rows = (history ?? []) as unknown as HistoryRow[];

  const initialCycles: {
    question: string;
    directorLabel: string;
    turns: SwarmTurn[];
  }[] = [];

  for (let i = 0; i < rows.length; i += TURNS_PER_CYCLE) {
    const chunk = rows.slice(i, i + TURNS_PER_CYCLE);
    const director = chunk[0];
    if (!director) continue;
    const isAgentDirector = AGENT_ID_SET.has(director.sender_id);
    // Prefer frozen label from contribution time; fall back for older rows
    const label = isAgentDirector
      ? 'Director'
      : director.sender_label || director.sender?.display_name || 'Director';
    const agentTurns: SwarmTurn[] = chunk.slice(1).map((turn) => ({
      agent: turn.sender_label || turn.sender?.display_name || 'Contributor',
      summary_conclusion: turn.summary_conclusion,
    }));
    initialCycles.push({
      question: director.summary_conclusion,
      directorLabel: label,
      turns: agentTurns,
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
