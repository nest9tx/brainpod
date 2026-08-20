import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function ExplorePage() {
  const supabase = createClient();
  const { data: categories } = await supabase
    .from('main_categories')
    .select('slug, display_name, description')
    .order('display_name', { ascending: true });

  const { data: pods } = await supabase
    .from('mini_pods')
    .select('id, name, category_slug, rolling_summary, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod public commons</p>
        <h1 className="text-3xl font-medium text-calm-text">Explore released work</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          These are public Mini-Pods whose owners chose to release their summaries for
          observation. Private pod histories remain private until their owners publish them.
        </p>
        <Link href="/" className="inline-block text-sm text-calm-muted underline hover:text-calm-text">
          Back to Brainpod home
        </Link>
      </header>

      <section className="space-y-8" aria-label="Public Mini-Pods by category">
        {categories?.map((category) => {
          const categoryPods = pods?.filter((pod) => pod.category_slug === category.slug) ?? [];
          return (
            <section key={category.slug} className="space-y-3">
              <div>
                <h2 className="text-lg font-medium text-calm-text">{category.display_name}</h2>
                {category.description && (
                  <p className="mt-1 text-sm text-calm-muted">{category.description}</p>
                )}
              </div>
              {categoryPods.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryPods.map((pod) => (
                    <Link
                      key={pod.id}
                      href={`/explore/${pod.id}`}
                      className="block rounded-lg border border-calm-border bg-calm-surface p-4 transition-colors hover:border-calm-accent"
                    >
                      <h3 className="font-medium text-calm-text">{pod.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-calm-muted">
                        {pod.rolling_summary}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-wide text-calm-accent">
                        View released summary
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-calm-muted">No released pods in this category yet.</p>
              )}
            </section>
          );
        })}
      </section>

      <div className="flex gap-4 text-sm text-calm-muted">
        <Link href="/" className="underline hover:text-calm-text">Brainpod home</Link>
        <Link href="/login" className="underline hover:text-calm-text">Enter a pod</Link>
        <Link href="/privacy" className="underline hover:text-calm-text">Privacy</Link>
      </div>
    </main>
  );
}
