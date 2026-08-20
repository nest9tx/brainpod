import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_PROFILE_IDS, ORIENTATION_POD_ID } from '@/lib/constants';
import OrientationPod, { type SwarmTurn } from './orientation-pod';
import PublicHome from './public-home';

const FREE_TIER_DAILY_LIMIT = 5;
// Every cycle writes exactly 1 Director turn + 4 agent turns, in that order.
const TURNS_PER_CYCLE = 5;

async function importLegacyTurns(admin: ReturnType<typeof createAdminClient>, userId: string, podId: string) {
  const { count: privateTurnCount } = await admin
    .from('pod_turns')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', podId);
  if ((privateTurnCount ?? 0) === 0) {
    const { data: legacyTurns } = await admin
      .from('pod_turns')
      .select('id, sender_id, summary_conclusion, collapsed_reasoning, turn_sequence, created_at')
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
    if (director.sender_id === AGENT_PROFILE_IDS.synthetix || !construct || existingTurnIds.has(construct.id)) continue;
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

  let { data: pod } = await supabase
    .from('mini_pods')
    .select('id, name, rolling_summary')
    .eq('created_by', user.id)
    .eq('category_slug', 'orientation')
    .eq('status', 'private_isolated')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (searchParams.pod) {
    const { data: requestedPod } = await supabase
      .from('mini_pods')
      .select('id, name, rolling_summary')
      .eq('id', searchParams.pod)
      .eq('created_by', user.id)
      .eq('status', 'private_isolated')
      .maybeSingle();
    if (requestedPod) pod = requestedPod;
  }

  if (!pod) {
    const admin = createAdminClient();
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

  await importLegacyTurns(createAdminClient(), user.id, pod.id);

  const [{ data: usage }, { data: history }] = await Promise.all([
    supabase
      .from('daily_usage_logs')
      .select('prompt_count')
      .eq('profile_id', user.id)
      .eq('usage_date', today)
      .maybeSingle(),
    supabase
      .from('pod_turns')
      .select('summary_conclusion, turn_sequence, sender:profiles(display_name)')
      .eq('pod_id', pod.id)
      .order('turn_sequence', { ascending: true })
      .limit(100),
  ]);

  const remainingPrompts = Math.max(FREE_TIER_DAILY_LIMIT - (usage?.prompt_count ?? 0), 0);

  const flatHistory: SwarmTurn[] =
    history?.map((turn) => ({
      agent: (turn.sender as unknown as { display_name: string } | null)?.display_name ?? 'Director',
      summary_conclusion: turn.summary_conclusion,
    })) ?? [];

  // Group into per-question cycles (newest first) so the timeline reads as a
  // collapsible feed instead of one long flat list.
  const initialCycles: { question: string; turns: SwarmTurn[] }[] = [];
  for (let i = 0; i < flatHistory.length; i += TURNS_PER_CYCLE) {
    const [director, ...agentTurns] = flatHistory.slice(i, i + TURNS_PER_CYCLE);
    if (director) initialCycles.push({ question: director.summary_conclusion, turns: agentTurns });
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
    />
  );
}

