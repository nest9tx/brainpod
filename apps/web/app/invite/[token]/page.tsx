import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import AcceptInviteButton from './accept-button';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('pod_invites')
    .select('id, invited_email, status, expires_at, can_direct, mini_pods(name, category_slug)')
    .eq('token', params.token)
    .maybeSingle();

  const pod = invite?.mini_pods as unknown as { name: string; category_slug: string } | null;
  const expired =
    invite && (invite.status === 'expired' || new Date(invite.expires_at).getTime() < Date.now());

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <SiteNav variant={user ? 'app' : 'public'} userEmail={user?.email ?? undefined} />

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod invitation</p>
        <h1 className="text-2xl font-medium text-calm-text">Join a private Mini-Pod</h1>
        <p className="text-sm leading-relaxed text-calm-muted">
          Invitations are intentional and limited. Accepting grants access only to the specific pod you
          were invited into — not the whole account.
        </p>
      </header>

      {!invite && (
        <p className="text-sm text-calm-muted">This invitation link is invalid or has been removed.</p>
      )}

      {invite && expired && (
        <p className="text-sm text-calm-muted">This invitation has expired. Ask the Director to send a new one.</p>
      )}

      {invite && invite.status === 'revoked' && (
        <p className="text-sm text-calm-muted">This invitation was revoked by the pod owner.</p>
      )}

      {invite && invite.status === 'accepted' && (
        <div className="space-y-3 rounded-lg border border-calm-border bg-calm-surface p-4 text-sm text-calm-muted">
          <p>This invitation has already been accepted.</p>
          {user && (
            <Link href="/workspace" className="text-calm-accent underline hover:text-calm-text">
              Go to Workspace
            </Link>
          )}
        </div>
      )}

      {invite && invite.status === 'pending' && !expired && (
        <section className="space-y-4 rounded-lg border border-calm-border bg-calm-surface p-5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-calm-text">{pod?.name ?? 'Private Mini-Pod'}</p>
            <p className="text-xs text-calm-muted">
              Invited as {invite.invited_email}
              {invite.can_direct ? ' · can direct the swarm' : ' · view access'}
            </p>
          </div>

          {!user && (
            <div className="space-y-2 text-sm text-calm-muted">
              <p>
                Sign in with <span className="text-calm-text">{invite.invited_email}</span> to accept.
                If you do not have an account yet, create one with that same email.
              </p>
              <Link
                href={`/login?next=/invite/${params.token}`}
                className="inline-block rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg"
              >
                Sign in to accept
              </Link>
            </div>
          )}

          {user && (
            <AcceptInviteButton
              token={params.token}
              expectedEmail={invite.invited_email}
              userEmail={user.email ?? ''}
            />
          )}
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
