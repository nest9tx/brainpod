import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ORIENTATION_POD_ID } from '@/lib/constants';
import OrientationPod from './orientation-pod';

const FREE_TIER_DAILY_LIMIT = 5;

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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
      .limit(50),
  ]);

  const remainingPrompts = Math.max(FREE_TIER_DAILY_LIMIT - (usage?.prompt_count ?? 0), 0);

  return (
    <OrientationPod
      podName={pod?.name ?? 'Orientation'}
      podSummary={pod?.rolling_summary ?? ''}
      initialRemainingPrompts={remainingPrompts}
      initialHistory={
        history?.map((turn) => ({
          agent: (turn.sender as unknown as { display_name: string } | null)?.display_name ?? 'Director',
          summary_conclusion: turn.summary_conclusion,
        })) ?? []
      }
    />
  );
}

