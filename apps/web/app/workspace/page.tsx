import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import PodManager from './pod-manager';
import DisplayNameEditor from './display-name';
import MembershipPanel from './membership-panel';
import MembershipFlash from './membership-flash';
import { dailyLimitForRole } from '@/lib/tiers';

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: { membership?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: permissionRows } = await admin
    .from('private_pod_permissions')
    .select('pod_id, can_direct')
    .eq('profile_id', user.id);

  const permittedIds = (permissionRows ?? []).map((row) => row.pod_id);
  const canDirectByPod = Object.fromEntries(
    (permissionRows ?? []).map((row) => [row.pod_id, row.can_direct])
  );

  const { data: ownedPods } = await admin
    .from('mini_pods')
    .select('id, name, category_slug, status, rolling_summary, created_at, created_by')
    .eq('created_by', user.id)
    .order('category_slug', { ascending: true })
    .order('name', { ascending: true });

  const { data: sharedPods } =
    permittedIds.length > 0
      ? await admin
          .from('mini_pods')
          .select('id, name, category_slug, status, rolling_summary, created_at, created_by')
          .in('id', permittedIds)
          .neq('created_by', user.id)
          .order('name', { ascending: true })
      : { data: [] };

  const pods = [...(ownedPods ?? []), ...(sharedPods ?? [])].map((pod) => ({
    ...pod,
    is_owner: pod.created_by === user.id,
    can_direct: pod.created_by === user.id || Boolean(canDirectByPod[pod.id]),
  }));

  const { data: categories } = await supabase
    .from('main_categories')
    .select('slug, display_name, description')
    .order('display_name', { ascending: true });

  const podIds = pods.map((pod) => pod.id);
  const ownedIds = (ownedPods ?? []).map((p) => p.id);

  const { data: rawArtifacts } = podIds.length
    ? await admin
        .from('artifacts')
        .select(
          'id, pod_id, question, public_release, public_summary, public_summary_source, veritas_score, is_verified, created_at'
        )
        .in('pod_id', podIds)
        .not('question', 'is', null)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const memberRole = profile?.role ?? 'free_public';
  const dailyLimit = dailyLimitForRole(memberRole);
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin
    .from('daily_usage_logs')
    .select('prompt_count')
    .eq('profile_id', user.id)
    .eq('usage_date', today)
    .maybeSingle();
  const usedToday = usage?.prompt_count ?? 0;

  const { data: pendingReceived } = user.email
    ? await admin
        .from('pod_invites')
        .select('id, token, invited_email, status, expires_at, mini_pods(name)')
        .eq('status', 'pending')
        .ilike('invited_email', user.email)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] };

  const [{ data: pendingSent }, { data: memberRows }] =
    ownedIds.length > 0
      ? await Promise.all([
          admin
            .from('pod_invites')
            .select('id, pod_id, invited_email, status, created_at, expires_at')
            .in('pod_id', ownedIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
          admin
            .from('private_pod_permissions')
            .select('id, pod_id, profile_id, can_direct, granted_at, profiles(display_name)')
            .in('pod_id', ownedIds)
            .neq('profile_id', user.id),
        ])
      : [{ data: [] }, { data: [] }];

  const collaborators = (memberRows ?? []).map((row) => ({
    permission_id: row.id,
    pod_id: row.pod_id,
    profile_id: row.profile_id,
    can_direct: row.can_direct,
    display_name:
      (row.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Collaborator',
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <SiteNav variant="app" userEmail={user.email ?? ''} />

      <header className="space-y-3 rounded-xl border border-calm-border-soft bg-calm-surface/60 p-4 shadow-glow sm:p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">Brainpod workspace</p>
        <h1 className="text-2xl font-medium leading-snug text-calm-text">Your Mini-Pods</h1>
        <p className="max-w-xl text-sm leading-relaxed text-calm-muted">
          Private rooms for questions, experiments, and evolving work. Set your Director display
          name below so shared pods show who directed each question. Inviting someone shares the
          entire pod history; you can revoke or remove access later without erasing recorded work.
        </p>
      </header>

      <MembershipFlash status={searchParams?.membership} />

      <DisplayNameEditor
        initialName={profile?.display_name ?? user.email?.split('@')[0] ?? 'Director'}
        email={user.email ?? ''}
      />

      <MembershipPanel role={memberRole} dailyLimit={dailyLimit} usedToday={usedToday} />

      <PodManager
        initialPods={pods}
        categories={categories ?? []}
        initialArtifacts={rawArtifacts ?? []}
        pendingInvites={(pendingReceived ?? []).map((invite) => ({
          id: invite.id,
          token: invite.token,
          pod_name:
            (invite.mini_pods as unknown as { name: string } | null)?.name ?? 'Private Mini-Pod',
          expires_at: invite.expires_at,
        }))}
        pendingSent={(pendingSent ?? []).map((invite) => ({
          id: invite.id,
          pod_id: invite.pod_id,
          invited_email: invite.invited_email,
          expires_at: invite.expires_at,
        }))}
        collaborators={collaborators}
      />

      <section className="panel space-y-2 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-calm-text">Workspace growth</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Email invitations are limited to 5 per day per Director. Removing access does not erase
          directed questions or swarm work already recorded in the pod.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
