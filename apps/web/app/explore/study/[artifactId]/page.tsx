import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import PublicInsights from '@/components/public-insights';
import CopyStudyButton from '@/components/copy-study-button';
import ReportStudyButton from '@/components/report-study-button';

function formatPublicStudyText(args: {
  question: string | null;
  podName: string;
  category: string;
  publicSummary: string | null;
  content: string | null;
  isVerified: boolean;
  score: number | null;
}): string {
  const lines = [
    `Brainpod · Public commons · ${args.category}`,
    `From: ${args.podName}`,
    args.isVerified
      ? `Verification: ${args.score ?? '—'}/100 · verified`
      : typeof args.score === 'number'
        ? `Verification: ${args.score}/100 · not verified`
        : 'Verification: not verified',
    '',
    'Director question:',
    args.question ?? 'Released study',
    '',
    'Director release note:',
    args.publicSummary?.trim() || 'No public summary was provided for this release.',
  ];

  if (args.content?.trim()) {
    lines.push('', 'Constructed artifact:', args.content.trim());
  }

  lines.push(
    '',
    '---',
    'Shared from Brainpod (LuminaNova.org 501(c)(3)). Attribution is collective; public insights and release notes are not independently verified evidence solely because they appear here.'
  );
  return lines.join('\n');
}

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

  const categoryName = category?.display_name ?? pod.category_slug;
  const releasedAt = artifact.created_at
    ? new Date(artifact.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const copyText = formatPublicStudyText({
    question: artifact.question,
    podName: pod.name,
    category: categoryName,
    publicSummary: artifact.public_summary,
    content: artifact.content,
    isVerified: artifact.is_verified,
    score: artifact.veritas_score,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <SiteNav variant={user ? 'app' : 'public'} userEmail={user?.email ?? undefined} />

      <header className="space-y-3 rounded-xl border border-calm-border-soft bg-calm-surface/60 p-4 shadow-glow sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">
            Brainpod public commons · {categoryName}
          </p>
          <CopyStudyButton text={copyText} />
        </div>
        <h1 className="text-2xl font-medium leading-snug text-calm-text break-words">
          {artifact.question ?? 'Released study'}
        </h1>
        <p className="text-sm text-calm-muted">
          From {pod.name}
          {releasedAt ? ` · ${releasedAt}` : ''}
        </p>
      </header>

      <section className="panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-medium text-calm-text">Director release note</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-text whitespace-pre-wrap break-words">
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
        <section className="panel space-y-3 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-calm-text">Constructed artifact</h2>
            <p className="text-xs text-calm-muted">
              Work product from the swarm cycle under human direction (@Synthetix and collaborators).
              Shown here because the Director released this study for public observation.
            </p>
          </div>
          <div className="text-sm leading-relaxed text-calm-text whitespace-pre-wrap break-words">
            {artifact.content}
          </div>
        </section>
      )}

      <PublicInsights
        artifactId={artifact.id}
        isSignedIn={!!user}
        currentUserId={user?.id}
      />

      <section className="space-y-2 border-t border-calm-border-soft pt-6">
        <h2 className="text-sm font-medium text-calm-text">Care of the commons</h2>
        <p className="text-xs leading-relaxed text-calm-muted">
          Brainpod is a collaborative public-benefit space under LuminaNova.org — not an advertising board.
          Releases should advance shared understanding. Pure self-promotion and link spam do not belong here.
        </p>
        <ReportStudyButton artifactId={artifact.id} isSignedIn={!!user} />
      </section>

      <section className="space-y-2 border-t border-calm-border-soft pt-6">
        <h2 className="text-sm font-medium text-calm-text">How to read this page</h2>
        <p className="text-xs leading-relaxed text-calm-muted">
          Explore list cards stay short on purpose. This detail page is the full public observation
          surface for a single released study. Public insights are optional, human-authored notes —
          not a second verification pass and not a social scoreboard. Private pod threads remain
          private unless their owners release them.
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
