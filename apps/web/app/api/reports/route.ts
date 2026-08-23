import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ReportReason } from '@/lib/steward';

const ALLOWED: ReportReason[] = ['self_promotion', 'spam', 'off_mission', 'other'];

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = await request.json();
  const artifactId = typeof body.artifact_id === 'string' ? body.artifact_id : '';
  const reason = body.reason as ReportReason;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (!artifactId || !ALLOWED.includes(reason)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: artifact } = await admin
    .from('artifacts')
    .select('id, public_release, creator_id')
    .eq('id', artifactId)
    .eq('public_release', true)
    .maybeSingle();

  if (!artifact) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Do not report your own release through this path.
  if (artifact.creator_id === user.id) {
    return NextResponse.json(
      {
        error: 'own_work',
        detail: 'To withdraw your own release, unpublish it from Workspace.',
      },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from('content_reports')
    .select('id')
    .eq('artifact_id', artifactId)
    .eq('reporter_id', user.id)
    .eq('source', 'human')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: 'already_reported',
        detail: 'You already reported this study. Thank you — a steward will review the queue.',
      },
      { status: 409 }
    );
  }

  const { error } = await admin.from('content_reports').insert({
    artifact_id: artifactId,
    reporter_id: user.id,
    reason,
    note: note || null,
    status: 'open',
    source: 'human',
  });

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      'Report received. A steward will review whether this release belongs in the public commons.',
  });
}
