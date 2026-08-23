import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSteward } from '@/lib/steward';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import StewardQueue from './steward-queue';

export default async function StewardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, display_name, is_steward')
    .eq('id', user.id)
    .maybeSingle();

  if (!isSteward(profile?.is_steward, user.id)) {
    redirect('/workspace');
  }

  const { data: reports } = await admin
    .from('content_reports')
    .select(
      'id, reason, note, status, source, created_at, artifact_id, artifacts(id, question, public_summary, public_release, veritas_score, is_verified)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(50);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <SiteNav variant="app" userEmail={user.email ?? ''} />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">Steward · Commons care</p>
        <h1 className="text-2xl font-medium text-calm-text">Open reports</h1>
        <p className="text-sm text-calm-muted">
          Human review only. Prefer unpublishing clear advertising; dismiss careful false positives.
          No automatic bans in this phase. Membership tier is independent of steward access.
        </p>
      </header>
      <StewardQueue initialReports={reports ?? []} />
      <SiteFooter />
    </main>
  );
}
