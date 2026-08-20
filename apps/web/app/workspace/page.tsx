import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function WorkspacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const { data: pods } = await supabase
    .from('mini_pods')
    .select('id, name, category_slug, status, rolling_summary, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod workspace</p>
          <h1 className="text-2xl font-medium text-calm-text">Your Mini-Pods</h1>
          <p className="max-w-xl text-sm leading-relaxed text-calm-muted">
            Private rooms for questions, experiments, and evolving work. A pod keeps its
            history, sources, artifacts, and verification trail together.
          </p>
        </div>
        <span className="shrink-0 text-xs text-calm-muted">{user.email}</span>
      </header>

      <section className="space-y-3" aria-label="Your Mini-Pods">
        {pods?.map((pod) => (
          <article
            key={pod.id}
            className="flex items-center justify-between gap-5 rounded-lg border border-calm-border bg-calm-surface p-5"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-medium text-calm-text">{pod.name}</h2>
                <span className="rounded-full border border-calm-accent px-2 py-0.5 text-xs text-calm-accent">
                  {pod.status === 'private_isolated' ? 'Private' : pod.status}
                </span>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-calm-muted">
                {pod.rolling_summary}
              </p>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg"
            >
              Open pod
            </Link>
          </article>
        ))}
      </section>

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">Workspace growth</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Team invitations, additional domain pods, BYOA connections, and tier controls will
          appear here as they become available. For now, your Orientation Pod is private to
          this account and is the place to begin.
        </p>
      </section>

      <div className="flex items-center gap-4 text-sm text-calm-muted">
        <Link href="/" className="underline hover:text-calm-text">
          Back to current pod
        </Link>
        <Link href="/privacy" className="underline hover:text-calm-text">
          Privacy
        </Link>
        <Link href="/terms" className="underline hover:text-calm-text">
          Terms
        </Link>
      </div>
    </main>
  );
}
