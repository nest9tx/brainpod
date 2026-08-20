import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { name, category_slug: categorySlug } = await request.json();
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 100) {
    return NextResponse.json({ error: 'invalid_pod_name' }, { status: 400 });
  }

  const { data: category } = await supabase
    .from('main_categories')
    .select('slug')
    .eq('slug', categorySlug)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pod, error: podError } = await admin
    .from('mini_pods')
    .insert({
      name: trimmedName,
      category_slug: category.slug,
      status: 'private_isolated',
      created_by: user.id,
    })
    .select('id, name, category_slug, status, rolling_summary, created_at')
    .single();
  if (podError || !pod) {
    return NextResponse.json({ error: 'pod_create_failed', detail: podError?.message }, { status: 500 });
  }

  const { error: permissionError } = await admin.from('private_pod_permissions').insert({
    pod_id: pod.id,
    profile_id: user.id,
    can_direct: true,
  });
  if (permissionError) {
    await admin.from('mini_pods').delete().eq('id', pod.id);
    return NextResponse.json(
      { error: 'pod_access_create_failed', detail: permissionError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ pod }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id, name } = await request.json();
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (typeof id !== 'string' || !trimmedName || trimmedName.length > 100) {
    return NextResponse.json({ error: 'invalid_pod_update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pod, error } = await admin
    .from('mini_pods')
    .update({ name: trimmedName })
    .eq('id', id)
    .eq('created_by', user.id)
    .select('id, name, category_slug, status, rolling_summary, created_at')
    .single();
  if (error || !pod) {
    return NextResponse.json({ error: 'pod_update_failed', detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ pod });
}
