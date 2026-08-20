import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ORIENTATION_POD_ID } from '@/lib/constants';

export default async function PublicPodPage({ params }: { params: { podId: string } }) {
  const supabase = createClient();
  const { data: pod } = await supabase
    .from('mini_pods')
    .select('id, name, category_slug, rolling_summary, created_at')
    .eq('id', params.podId)
    .eq('status', 'active')
    .neq('id', ORIENTATION_POD_ID)
    .maybeSingle();

  if (!pod) notFound();

  const { data: category } = await supabase
    .from('main_categories')
    .select('display_name')
    .eq('slug', pod.category_slug)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod public commons · {category?.display_name ?? pod.category_slug}
        </p>
        <h1 className="text-3xl font-medium text-calm-text">{pod.name}</h1>
        <p className="text-xs uppercase tracking-wide text-calm-accent">
          Released for observation
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-calm-border bg-calm-surface p-6">
        <h2 className="text-lg font-medium text-calm-text">Released summary</h2>
        <p className="text-sm leading-relaxed text-calm-muted">{pod.rolling_summary}</p>
        <p className="border-t border-calm-border pt-4 text-xs leading-relaxed text-calm-muted">
          This public page contains only the summary the pod owner chose to release. Questions,
          agent turns, sources, artifacts, and private collaboration history remain inside the
          pod unless separately published.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm text-calm-muted">
        <Link href="/explore" className="underline hover:text-calm-text">
          Back to Explore
        </Link>
        <Link href="/login" className="underline hover:text-calm-text">
          Enter Brainpod
        </Link>
        <Link href="/privacy" className="underline hover:text-calm-text">
          Privacy
        </Link>
      </div>
    </main>
  );
}
