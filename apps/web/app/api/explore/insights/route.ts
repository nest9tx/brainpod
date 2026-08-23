import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  countExternalUrls,
  MAX_EXTERNAL_LINKS_IN_INSIGHT,
} from '@/lib/link-limits';

const MAX_BODY = 800;

export async function GET(request: NextRequest) {
  const artifactId = request.nextUrl.searchParams.get('artifact_id');
  if (!artifactId) {
    return NextResponse.json({ error: 'artifact_id_required' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('id')
    .eq('id', artifactId)
    .eq('public_release', true)
    .maybeSingle();
  if (!artifact) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: insights, error } = await supabase
    .from('artifact_insights')
    .select('id, body, author_label, created_at, author_id')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'load_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ insights: insights ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const artifactId: string = body.artifact_id;
  const text: string = typeof body.body === 'string' ? body.body.trim() : '';

  if (!artifactId) {
    return NextResponse.json({ error: 'artifact_id_required' }, { status: 400 });
  }
  if (!text || text.length > MAX_BODY) {
    return NextResponse.json(
      { error: 'invalid_body', detail: `Insight must be 1–${MAX_BODY} characters.` },
      { status: 400 }
    );
  }

  if (countExternalUrls(text) > MAX_EXTERNAL_LINKS_IN_INSIGHT) {
    return NextResponse.json(
      {
        error: 'too_many_external_links',
        detail: `Public insights may include at most ${MAX_EXTERNAL_LINKS_IN_INSIGHT} external link. Prefer observation over advertising.`,
      },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: artifact } = await admin
    .from('artifacts')
    .select('id, public_release')
    .eq('id', artifactId)
    .maybeSingle();
  if (!artifact?.public_release) {
    return NextResponse.json({ error: 'not_public' }, { status: 403 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const authorLabel =
    profile?.display_name?.trim() || user.email?.split('@')[0] || 'Director';

  const { data: existing } = await admin
    .from('artifact_insights')
    .select('id')
    .eq('artifact_id', artifactId)
    .eq('author_id', user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error: 'already_contributed',
        detail:
          'You already shared one insight on this study. One calm note per Director keeps the commons readable.',
      },
      { status: 409 }
    );
  }

  const { data: insight, error } = await admin
    .from('artifact_insights')
    .insert({
      artifact_id: artifactId,
      author_id: user.id,
      body: text,
      author_label: authorLabel.slice(0, 40),
    })
    .select('id, body, author_label, created_at, author_id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ insight });
}

export async function DELETE(request: NextRequest) {
  const insightId = request.nextUrl.searchParams.get('id');
  if (!insightId) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('artifact_insights')
    .select('id, author_id')
    .eq('id', insightId)
    .maybeSingle();
  if (!row || row.author_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await admin.from('artifact_insights').delete().eq('id', insightId);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
