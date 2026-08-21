import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function isDistinctSummary(summary: string, question: string): boolean {
  const s = summary.trim().toLowerCase();
  const q = question.trim().toLowerCase();
  if (!s || s.length < 24) return false;
  if (s === q) return false;
  if (q && s.startsWith(q.slice(0, Math.min(q.length, 80)))) return false;
  return true;
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json();
  const id = body.id;
  const publish = body.publish;
  const public_summary = body.public_summary;

  if (typeof id !== 'string' || typeof publish !== 'boolean') {
    return NextResponse.json({ error: 'invalid_release_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: artifact } = await admin
    .from('artifacts')
    .select('id, pod_id, question, public_release, mini_pods!inner(created_by)')
    .eq('id', id)
    .eq('mini_pods.created_by', user.id)
    .maybeSingle();
  if (!artifact) return NextResponse.json({ error: 'artifact_not_owned' }, { status: 403 });

  const summary = typeof public_summary === 'string' ? public_summary.trim() : '';

  // Publishing or updating a live release requires a distinct owner summary.
  if (publish && !isDistinctSummary(summary, artifact.question ?? '')) {
    return NextResponse.json(
      {
        error: 'summary_required',
        detail:
          'Write a short public summary in your own words before releasing or updating. It should not just repeat the question.',
      },
      { status: 400 }
    );
  }

  const updatePayload = publish
    ? {
        public_release: true,
        public_summary: summary,
        public_summary_source: 'owner_authored' as const,
      }
    : {
        public_release: false,
        // Keep the last summary draft available in Workspace after unpublish.
        public_summary: summary || null,
        public_summary_source: summary ? ('owner_authored' as const) : null,
      };

  const { data: updated, error } = await admin
    .from('artifacts')
    .update(updatePayload)
    .eq('id', id)
    .select('id, pod_id, question, public_release, public_summary, veritas_score, is_verified')
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: 'artifact_release_failed', detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ artifact: updated });
}
