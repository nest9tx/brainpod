import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id, publish } = await request.json();
  if (typeof id !== 'string' || typeof publish !== 'boolean') {
    return NextResponse.json({ error: 'invalid_publish_request' }, { status: 400 });
  }

  if (publish) {
    const { data: currentPod } = await supabase
      .from('mini_pods')
      .select('rolling_summary')
      .eq('id', id)
      .eq('created_by', user.id)
      .maybeSingle();
    if (currentPod?.rolling_summary === 'Initial context baseline setting up...') {
      return NextResponse.json(
        { error: 'summary_required', detail: 'Add a meaningful released summary before publishing this pod.' },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();
  const { data: pod, error } = await admin
    .from('mini_pods')
    .update({ status: publish ? 'active' : 'private_isolated' })
    .eq('id', id)
    .eq('created_by', user.id)
    .select('id, name, category_slug, status, rolling_summary, created_at')
    .single();

  if (error || !pod) {
    return NextResponse.json(
      { error: 'pod_visibility_update_failed', detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ pod });
}
