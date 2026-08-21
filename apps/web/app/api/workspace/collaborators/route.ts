import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** List pending invites + active collaborators for pods the user owns. */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: ownedPods } = await admin
    .from('mini_pods')
    .select('id')
    .eq('created_by', user.id);
  const ownedIds = (ownedPods ?? []).map((p) => p.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ pending_invites: [], members: [] });
  }

  const [{ data: pending }, { data: permissions }] = await Promise.all([
    admin
      .from('pod_invites')
      .select('id, pod_id, invited_email, status, created_at, expires_at')
      .in('pod_id', ownedIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    admin
      .from('private_pod_permissions')
      .select('id, pod_id, profile_id, can_direct, granted_at, profiles(display_name)')
      .in('pod_id', ownedIds)
      .neq('profile_id', user.id),
  ]);

  const members = (permissions ?? []).map((row) => ({
    permission_id: row.id,
    pod_id: row.pod_id,
    profile_id: row.profile_id,
    can_direct: row.can_direct,
    granted_at: row.granted_at,
    display_name:
      (row.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Collaborator',
  }));

  return NextResponse.json({
    pending_invites: pending ?? [],
    members,
  });
}

/**
 * Remove access without deleting history.
 * - Owner removes a collaborator from their pod
 * - Collaborator leaves a shared pod themselves
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json();
  const podId = body.pod_id;
  const profileId = typeof body.profile_id === 'string' ? body.profile_id : user.id;

  if (typeof podId !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pod } = await admin
    .from('mini_pods')
    .select('id, created_by')
    .eq('id', podId)
    .maybeSingle();
  if (!pod) return NextResponse.json({ error: 'pod_not_found' }, { status: 404 });

  const isOwner = pod.created_by === user.id;
  const isSelfLeave = profileId === user.id;

  if (!isOwner && !isSelfLeave) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Never remove the owner's own permission row this way
  if (profileId === pod.created_by) {
    return NextResponse.json({ error: 'cannot_remove_owner' }, { status: 400 });
  }

  const { error } = await admin
    .from('private_pod_permissions')
    .delete()
    .eq('pod_id', podId)
    .eq('profile_id', profileId);

  if (error) {
    return NextResponse.json({ error: 'remove_failed', detail: error.message }, { status: 500 });
  }

  // History (pod_turns, artifacts) is intentionally left intact.
  return NextResponse.json({ removed: true, pod_id: podId, profile_id: profileId });
}
