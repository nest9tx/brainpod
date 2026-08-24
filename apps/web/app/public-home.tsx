import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default async function PublicHome() {
  const supabase = createClient();
  const { data: featured } = await supabase
    .from('artifacts')
    .select(
      'id, question, public_summary, veritas_score, is_verified, created_at, mini_pods!inner(name, category_slug)'
    )
    .eq('public_release', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const featuredPod = featured
    ? (featured.mini_pods as unknown as { name: string; category_slug: string })
    : null;

  let featuredCategory: string | null = null;
  if (featuredPod) {
    const { data: cat } = await supabase
      .from('main_categories')
      .select('display_name')
      .eq('slug', featuredPod.category_slug)
      .maybeSingle();
    featuredCategory = cat?.display_name ?? featuredPod.category_slug;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12">
      <SiteNav variant="public" />

      <header className="max-w-2xl space-y-4 rounded-xl border border-calm-border-soft bg-calm-surface/60 p-5 shadow-glow sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">
          Human-directed collaborative inquiry · LuminaNova.org 501(c)(3)
        </p>
        <h1 className="text-3xl font-medium leading-tight text-calm-text">Brainpod</h1>
        <p className="text-lg leading-relaxed text-calm-text">
          Direct specialized AI agents through research, challenge, construction, and verification —
          then keep the work private, or release a clear study for public observation.
        </p>
        <p className="text-base leading-relaxed text-calm-muted">
          A Director poses a real question. The swarm grounds it, stress-tests it, builds an
          artifact, and checks rigor. You leave with an inspectable study — not a scoreboard of
          points to cash out.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/login"
            className="rounded-lg bg-calm-accent px-5 py-3 text-sm font-medium text-calm-bg shadow-glow"
          >
            Begin as Director
          </Link>
          <Link href="/explore" className="text-sm text-calm-muted underline hover:text-calm-text">
            Explore released studies
          </Link>
        </div>
      </header>

      <section className="space-y-3" aria-label="How a study works">
        <h2 className="text-lg font-medium text-calm-text">How a study works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          <li className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-calm-muted">1 · Direct</p>
            <p className="mt-1 text-sm leading-relaxed text-calm-text">
              Ask in Brainstorm, Assist, or Construct &amp; Verify. Attach a brief or note when
              materials matter.
            </p>
          </li>
          <li className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-calm-astra">2 · Ground</p>
            <p className="mt-1 text-sm leading-relaxed text-calm-muted">
              <span className="text-calm-astra">@Astra</span> gathers evidence and relevant
              context under your constraint.
            </p>
          </li>
          <li className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-calm-kaelen">3 · Challenge</p>
            <p className="mt-1 text-sm leading-relaxed text-calm-muted">
              <span className="text-calm-kaelen">@Kaelen</span> pressure-tests assumptions, gaps,
              and practical risks.
            </p>
          </li>
          <li className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-calm-synthetix">4 · Construct &amp; verify</p>
            <p className="mt-1 text-sm leading-relaxed text-calm-muted">
              <span className="text-calm-synthetix">@Synthetix</span> builds the artifact;{' '}
              <span className="text-calm-veritas">@Veritas</span> scores study-level rigor (Proof-of-Value),
              not agent ranking.
            </p>
          </li>
        </ol>
        <p className="text-sm leading-relaxed text-calm-muted">
          Work stays in your private Mini-Pod until you choose to release a Director-authored
          summary to the public commons.
        </p>
      </section>

      {featured && featuredPod && (
        <section className="panel space-y-3 p-5" aria-label="Example released study">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-calm-text">From the commons</h2>
            <p className="text-xs text-calm-muted">
              {featured.is_verified
                ? `Verified · ${featured.veritas_score ?? '—'}/100`
                : typeof featured.veritas_score === 'number'
                  ? `Observed · ${featured.veritas_score}/100`
                  : 'Released for observation'}
            </p>
          </div>
          <p className="text-xs uppercase tracking-wide text-calm-muted">
            {featuredCategory ?? 'Study'} · {featuredPod.name}
          </p>
          <p className="text-base leading-snug text-calm-text break-words">
            {featured.question ?? 'Released study'}
          </p>
          {featured.public_summary?.trim() && (
            <p className="text-sm leading-relaxed text-calm-muted whitespace-pre-wrap break-words line-clamp-4">
              {featured.public_summary.trim()}
            </p>
          )}
          <Link
            href={`/explore/study/${featured.id}`}
            className="inline-block text-sm text-calm-accent underline hover:text-calm-text"
          >
            Read full study
          </Link>
        </section>
      )}

      {!featured && (
        <section className="panel space-y-2 p-5" aria-label="What a completed study looks like">
          <h2 className="text-lg font-medium text-calm-text">What a completed study looks like</h2>
          <p className="text-sm leading-relaxed text-calm-muted">
            A released study is a durable record: the Director question, a human release note,
            the constructed artifact when present, and a verification outcome. You can copy or
            download it as Markdown for citation and offline use. Explore will fill with real
            public work as Directors publish.
          </p>
          <Link href="/explore" className="text-sm text-calm-accent underline hover:text-calm-text">
            Open Explore
          </Link>
        </section>
      )}

      <section className="panel space-y-3 p-5">
        <h2 className="text-lg font-medium text-calm-text">What you can do</h2>
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-calm-muted">
          <li>Run multi-turn studies in private Mini-Pods and invite collaborators by email</li>
          <li>Attach briefs or notes so verification respects your materials</li>
          <li>Release a short public summary only when you choose</li>
          <li>Copy or download a study as structured Markdown for your own records</li>
        </ul>
      </section>

      <section className="space-y-2 border-t border-calm-border-soft pt-6">
        <h2 className="text-sm font-medium text-calm-text">Sign-in &amp; stewardship</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-calm-muted">
          Sign-in (Google or email link) creates your account, private Workspace, and daily prompt
          limits. Brainpod does not read Gmail, Drive, or contacts, and does not sell identity data
          for ads. Full detail is in the{' '}
          <Link href="/privacy" className="underline hover:text-calm-text">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="underline hover:text-calm-text">
            Terms
          </Link>
          . This is collaborative infrastructure under LuminaNova.org — not a marketplace or
          cash-out ledger.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-calm-accent px-5 py-3 text-sm font-medium text-calm-bg shadow-glow"
        >
          Sign in to Brainpod
        </Link>
        <Link href="/explore" className="text-sm text-calm-muted underline hover:text-calm-text">
          Explore without signing in
        </Link>
      </div>

      <SiteFooter />
    </main>
  );
}
