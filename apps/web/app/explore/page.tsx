import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export default async function ExplorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: categories } = await supabase
    .from('main_categories')
    .select('slug, display_name, description')
    .order('display_name', { ascending: true });

  const { data: rawStudies } = await supabase
    .from('artifacts')
    .select(
      'id, question, public_summary, veritas_score, is_verified, mini_pods!inner(id, name, category_slug)'
    )
    .eq('public_release', true)
    .not('question', 'is', null)
    .order('created_at', { ascending: false });

  const studyByQuestion = new Map<string, NonNullable<typeof rawStudies>[number]>();
  for (const study of rawStudies ?? []) {
    const key = study.question?.trim().toLowerCase() ?? study.id;
    if (!studyByQuestion.has(key)) studyByQuestion.set(key, study);
  }
  const studies = [...studyByQuestion.values()];

  const categoriesWithWork =
    categories?.filter((category) =>
      studies.some((study) => {
        const pod = study.mini_pods as unknown as { category_slug: string };
        return pod.category_slug === category.slug;
      })
    ) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <SiteNav variant={user ? 'app' : 'public'} userEmail={user?.email ?? undefined} />

      <header className="space-y-3 rounded-xl border border-calm-border-soft bg-calm-surface/60 p-4 shadow-glow sm:p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">
          Brainpod public commons
        </p>
        <h1 className="text-2xl font-medium leading-snug text-calm-text sm:text-3xl">
          Explore released work
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Short public summaries chosen by Directors. Open a study to read the full release and, if
          you wish, leave one calm insight. Private pod histories stay private until their owners
          release them.
        </p>
      </header>

      {categoriesWithWork.length === 0 ? (
        <p className="panel p-5 text-sm text-calm-muted">No released studies yet.</p>
      ) : (
        <section className="space-y-8" aria-label="Released studies by category">
          {categoriesWithWork.map((category) => {
            const categoryStudies = studies.filter((study) => {
              const pod = study.mini_pods as unknown as { category_slug: string };
              return pod.category_slug === category.slug;
            });
            return (
              <section key={category.slug} className="space-y-3">
                <div className="px-1">
                  <h2 className="text-lg font-medium text-calm-text">{category.display_name}</h2>
                  {category.description && (
                    <p className="mt-1 text-sm text-calm-muted">{category.description}</p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryStudies.map((study) => {
                    const pod = study.mini_pods as unknown as { name: string };
                    const title = clip(study.question ?? 'Released study', 140);
                    const summary = study.public_summary
                      ? clip(study.public_summary, 180)
                      : null;
                    return (
                      <Link
                        key={study.id}
                        href={`/explore/study/${study.id}`}
                        className="panel block p-4 transition-colors hover:border-calm-accent/50 hover:shadow-glow"
                      >
                        <h3 className="text-sm font-medium leading-snug text-calm-text">{title}</h3>
                        {summary && (
                          <p className="mt-2 text-sm leading-relaxed text-calm-muted">{summary}</p>
                        )}
                        <p className="mt-3 text-xs text-calm-muted">
                          {pod.name}
                          {' · '}
                          {study.is_verified ? (
                            <span className="text-calm-accent">
                              Verified · {study.veritas_score ?? '—'}/100
                            </span>
                          ) : (
                            'Released for observation'
                          )}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
