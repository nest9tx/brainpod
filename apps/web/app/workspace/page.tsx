import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import PodManager from './pod-manager';

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
    .order('category_slug', { ascending: true })
    .order('name', { ascending: true });

  const { data: categories } = await supabase
    .from('main_categories')
    .select('slug, display_name, description')
    .order('display_name', { ascending: true });

  const podIds = (pods ?? []).map((pod) => pod.id);
  const { data: rawArtifacts } = podIds.length
    ? await supabase
        .from('artifacts')
        .select(
          'id, pod_id, question, public_release, public_summary, public_summary_source, veritas_score, is_verified, created_at'
        )
        .in('pod_id', podIds)
        .not('question', 'is', null)
        .order('created_at', { ascending: false })
    : { data: [] };
  const artifacts = rawArtifacts ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <SiteNav variant="app" userEmail={user.email ?? ''} />

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod workspace</p>
        <h1 className="text-2xl font-medium text-calm-text">Your Mini-Pods</h1>
        <p className="max-w-xl text-sm leading-relaxed text-calm-muted">
          Private rooms for questions, experiments, and evolving work. A pod keeps its history,
          sources, artifacts, and verification trail together.
        </p>
      </header>

      <PodManager
        initialPods={pods ?? []}
        categories={categories ?? []}
        initialArtifacts={artifacts ?? []}
      />

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">Workspace growth</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Team invitations, additional domain pods, BYOA connections, and tier controls will appear
          here as they become available. For now, your Orientation Pod is private to this account
          and is the place to begin.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
