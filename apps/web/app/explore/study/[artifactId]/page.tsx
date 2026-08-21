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
      'id, question, public_summary, public_summary_source, veritas_score, is_verified, mini_pods!inner(name, category_slug)'
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <SiteNav variant={user ? 'app' : 'public'} userEmail={user?.email ?? undefined} />

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod public commons · {category?.display_name ?? pod.category_slug}
        </p>
        <h1 className="text-3xl font-medium text-calm-text">Released study</h1>
        <p className="text-sm text-calm-muted">From {pod.name}</p>
      </header>
      <section className="space-y-4 rounded-lg border border-calm-border bg-calm-surface p-6">
        <h2 className="text-lg font-medium text-calm-text">Question</h2>
        <p className="text-sm leading-relaxed text-calm-muted">{artifact.question}</p>
        <h2 className="pt-4 text-lg font-medium text-calm-text">
          {artifact.public_summary_source === 'system_generated'
            ? 'System-generated summary'
            : 'Owner-authored summary'}
        </h2>
        <p className="text-sm leading-relaxed text-calm-muted">{artifact.public_summary}</p>
        <p className="text-xs leading-relaxed text-calm-muted">
          This summary is separate from @Veritas&apos;s artifact verdict and must not be read as
          independently verified. Future system-generated summaries will carry their own provenance.
        </p>
        <p className={artifact.is_verified ? 'text-sm text-calm-accent' : 'text-sm text-calm-muted'}>
          {artifact.is_verified
            ? `Verified · ${artifact.veritas_score ?? '—'}/100`
            : 'Released for observation · not verified'}
        </p>
      </section>
      <div className="flex flex-wrap gap-4 text-sm text-calm-muted">
        <Link href="/explore" className="underline hover:text-calm-text">
          Back to Explore
        </Link>
        {!user && (
          <Link href="/login" className="underline hover:text-calm-text">
            Enter Brainpod
          </Link>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
