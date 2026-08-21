import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { token } = await request.json();
  if (typeof token !== 'string' || !token.trim()) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('pod_invites')
    .select('id, pod_id, invited_email, can_direct, status, expires_at')
    .eq('token', token.trim())
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: 'invite_not_found' }, { status: 404 });
  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'invite_not_pending', status: invite.status }, { status: 409 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('pod_invites').update({ status: 'expired' }).eq('id', invite.id);
    return NextResponse.json({ error: 'invite_expired' }, { status: 410 });
  }

  const userEmail = (user.email ?? '').trim().toLowerCase();
  if (!userEmail || userEmail !== invite.invited_email.toLowerCase()) {
    return NextResponse.json(
      {
        error: 'email_mismatch',
        detail: `Sign in with ${invite.invited_email} to accept this invitation.`,
      },
      { status: 403 }
    );
  }

  // Ensure profile exists for this auth user
  await admin.from('profiles').upsert(
    {
      id: user.id,
      display_name: user.email?.split('@')[0] ?? 'Director',
    },
    { onConflict: 'id' }
  );

  const { error: permError } = await admin.from('private_pod_permissions').upsert(
    {
      pod_id: invite.pod_id,
      profile_id: user.id,
      can_direct: invite.can_direct,
    },
    { onConflict: 'pod_id,profile_id' }
  );
  if (permError) {
    return NextResponse.json({ error: 'permission_grant_failed', detail: permError.message }, { status: 500 });
  }

  await admin
    .from('pod_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  const { data: pod } = await admin
    .from('mini_pods')
    .select('id, name')
    .eq('id', invite.pod_id)
    .maybeSingle();

  return NextResponse.json({
    accepted: true,
    pod: pod ?? { id: invite.pod_id, name: 'Mini-Pod' },
  });
}
