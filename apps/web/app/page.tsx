import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OrientationPod, { type SwarmTurn } from './orientation-pod';
import PublicHome from './public-home';

const FREE_TIER_DAILY_LIMIT = 5;
// Every cycle writes exactly 1 Director turn + 4 agent turns, in that order.
const TURNS_PER_CYCLE = 5;

export default async function Home() {
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

