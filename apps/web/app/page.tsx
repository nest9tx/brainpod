import { createClient } from '@/lib/supabase/server';
import { ORIENTATION_POD_ID } from '@/lib/constants';
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

  const [{ data: usage }, { data: pod }, { data: history }] = await Promise.all([
    supabase
      .from('daily_usage_logs')
      .select('prompt_count')
      .eq('profile_id', user.id)
      .eq('usage_date', today)
      .maybeSingle(),
    supabase.from('mini_pods').select('name, rolling_summary').eq('id', ORIENTATION_POD_ID).single(),
    supabase
      .from('pod_turns')
      .select('summary_conclusion, turn_sequence, sender:profiles(display_name)')
      .eq('pod_id', ORIENTATION_POD_ID)
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
      podName={pod?.name ?? 'Orientation'}
      podSummary={pod?.rolling_summary ?? ''}
      initialRemainingPrompts={remainingPrompts}
      initialCycles={initialCycles}
      userEmail={user.email ?? ''}
    />
  );
}

