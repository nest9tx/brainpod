import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id, publish, public_summary } = await request.json();
  if (typeof id !== 'string' || typeof publish !== 'boolean') {
    return NextResponse.json({ error: 'invalid_release_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: artifact } = await admin
    .from('artifacts')
    .select('id, pod_id, mini_pods!inner(created_by)')
    .eq('id', id)
    .eq('mini_pods.created_by', user.id)
    .maybeSingle();
  if (!artifact) return NextResponse.json({ error: 'artifact_not_owned' }, { status: 403 });

  const summary = typeof public_summary === 'string' ? public_summary.trim() : '';
  if (publish && (!summary || summary === (await getArtifactQuestion(admin, id)))) {
    return NextResponse.json({ error: 'summary_required' }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from('artifacts')
    .update({
      public_release: publish,
      public_summary: publish ? summary : null,
      public_summary_source: 'owner_authored',
    })
    .eq('id', id)
    .select('id, pod_id, question, public_release, public_summary, veritas_score, is_verified')
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: 'artifact_release_failed', detail: error?.message }, { status: 500 });
  }
  return NextResponse.json({ artifact: updated });
}

async function getArtifactQuestion(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from('artifacts').select('question').eq('id', id).maybeSingle();
  return data?.question?.trim() ?? '';
}