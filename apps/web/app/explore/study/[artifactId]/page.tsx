import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default async function PublicStudyPage({ params }: { params: { artifactId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: artifact } = await supabase
    .from('artifacts')
    .select(
      'id, question, content, public_summary, public_summary_source, veritas_score, is_verified, created_at, mini_pods!inner(name, category_slug)'
    )
    .eq('id', params.artifactId)
    .eq('public_release', true)
    .maybeSingle();
  if (!artifact) notFound();

  const pod = artifact.mini_pods as unknown as { name: string; category_slug: string };
  const { data: category } = await supabase
    .from('main_categories')
    .select('display_name')
    .eq('slug', pod.category_slug)
    .maybeSingle();

  const releasedAt = artifact.created_at
    ? new Date(artifact.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <SiteNav variant={user ? 'app' : 'public'} userEmail={user?.email ?? undefined} />

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod public commons · {category?.display_name ?? pod.category_slug}
        </p>
        <h1 className="text-2xl font-medium leading-snug text-calm-text">
          {artifact.question ?? 'Released study'}
        </h1>
        <p className="text-sm text-calm-muted">
          From {pod.name}
          {releasedAt ? ` · ${releasedAt}` : ''}
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-calm-border bg-calm-surface p-6">
        <div>
          <h2 className="text-sm font-medium text-calm-text">Director release note</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-text whitespace-pre-wrap">
            {artifact.public_summary?.trim()
              ? artifact.public_summary
              : 'No public summary was provided for this release.'}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-calm-muted">
            This note is written by the human Director who released the work. It is separate from
            @Veritas verification and should not be read as independently verified evidence by itself.
          </p>
        </div>

        <div className="border-t border-calm-border pt-4">
          <p
            className={
              artifact.is_verified ? 'text-sm text-calm-accent' : 'text-sm text-calm-muted'
            }
          >
            {artifact.is_verified
              ? `Verified · ${artifact.veritas_score ?? '—'}/100`
              : typeof artifact.veritas_score === 'number'
                ? `Released for observation · score ${artifact.veritas_score}/100 · not verified`
                : 'Released for observation · not verified'}
          </p>
        </div>
      </section>

      {artifact.content?.trim() && (
        <section className="space-y-3 rounded-lg border border-calm-border bg-calm-surface p-6">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-calm-text">Constructed artifact</h2>
            <p className="text-xs text-calm-muted">
              Work product from the swarm cycle under human direction (@Synthetix and collaborators).
              Shown here because the Director released this study for public observation.
            </p>
          </div>
          <div className="text-sm leading-relaxed text-calm-text whitespace-pre-wrap">
            {artifact.content}
          </div>
        </section>
      )}

      <section className="space-y-2 border-t border-calm-border pt-6">
        <h2 className="text-sm font-medium text-calm-text">How to read this page</h2>
        <p className="text-xs leading-relaxed text-calm-muted">
          Explore list cards stay short on purpose. This detail page is the full public observation
          surface for a single released study. Public discussion and co-contribution on released work
          will open in a later phase; private pod threads remain private unless their owners release
          them.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm text-calm-muted">
        <Link href="/explore" className="underline hover:text-calm-text">
          Back to Explore
        </Link>
        {!user && (
          <Link href="/login" className="underline hover:text-calm-text">
            Sign in to Brainpod
          </Link>
        )}
        {user && (
          <Link href="/workspace" className="underline hover:text-calm-text">
            Your Workspace
          </Link>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
