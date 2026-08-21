import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, role, current_pov')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: profile ?? {
      id: user.id,
      display_name: user.email?.split('@')[0] ?? 'Director',
      role: 'free_public',
      current_pov: 0,
    },
    email: user.email ?? '',
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json();
  const raw = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  if (!raw || raw.length > 40) {
    return NextResponse.json(
      { error: 'invalid_display_name', detail: 'Use a short display name (1–40 characters).' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name: raw,
      },
      { onConflict: 'id' }
    )
    .select('id, display_name, role, current_pov')
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile_update_failed', detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
