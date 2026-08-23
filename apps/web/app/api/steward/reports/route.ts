import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSteward } from '@/lib/steward';

async function requireSteward() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!isSteward(profile?.role, user.id)) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }

  return { user, admin };
}

export async function GET() {
  const gate = await requireSteward();
  if ('error' in gate && gate.error) return gate.error;
  const { admin } = gate as { admin: ReturnType<typeof createAdminClient> };

  const { data, error } = await admin
    .from('content_reports')
    .select(
      'id, reason, note, status, source, created_at, artifact_id, steward_note, artifacts(id, question, public_summary, public_release, veritas_score, is_verified)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'load_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSteward();
  if ('error' in gate && gate.error) return gate.error;
  const { user, admin } = gate as {
    user: { id: string };
    admin: ReturnType<typeof createAdminClient>;
  };

  const body = await request.json();
  const reportId = typeof body.report_id === 'string' ? body.report_id : '';
  const action = body.action as 'dismiss' | 'unpublish' | 'reviewed';
  const stewardNote =
    typeof body.steward_note === 'string' ? body.steward_note.trim().slice(0, 500) : '';

  if (!reportId || !['dismiss', 'unpublish', 'reviewed'].includes(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const { data: report } = await admin
    .from('content_reports')
    .select('id, artifact_id, status')
    .eq('id', reportId)
    .maybeSingle();

  if (!report || report.status !== 'open') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'unpublish') {
    await admin
      .from('artifacts')
      .update({ public_release: false })
      .eq('id', report.artifact_id);
  }

  const status =
    action === 'unpublish' ? 'actioned' : action === 'dismiss' ? 'dismissed' : 'reviewed';

  const { error } = await admin
    .from('content_reports')
    .update({
      status,
      steward_note: stewardNote || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', reportId);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
