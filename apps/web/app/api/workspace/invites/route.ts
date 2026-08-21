import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

const MAX_INVITES_PER_DAY = 5;
const MAX_PENDING_PER_POD = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendInviteEmail(opts: {
  to: string;
  podName: string;
  inviterEmail: string;
  inviteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL ?? 'Brainpod <invites@luminanova.org>';
  if (!apiKey) return { sent: false as const, reason: 'email_not_configured' as const };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: `You're invited to collaborate in ${opts.podName} on Brainpod`,
      text: [
        `${opts.inviterEmail} invited you to a private Mini-Pod on Brainpod: ${opts.podName}.`,
        '',
        'Brainpod is a public-benefit human–AI collaboration space under LuminaNova.org.',
        '',
        `Accept the invitation (sign in or create an account with this email):`,
        opts.inviteUrl,
        '',
        'This link expires in 14 days. If you did not expect this invite, you can ignore it.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false as const, reason: 'email_send_failed' as const, detail };
  }
  return { sent: true as const };
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const email = normalizeEmail(user.email ?? '');

  const [{ data: sent }, { data: received }] = await Promise.all([
    admin
      .from('pod_invites')
      .select('id, pod_id, invited_email, can_direct, status, created_at, expires_at, mini_pods(name)')
      .eq('invited_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    email
      ? admin
          .from('pod_invites')
          .select('id, pod_id, invited_email, can_direct, status, token, created_at, expires_at, mini_pods(name)')
          .eq('status', 'pending')
          .ilike('invited_email', email)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ sent: sent ?? [], received: received ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json();
  const podId = body.pod_id;
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const canDirect = body.can_direct !== false;

  if (typeof podId !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_invite' }, { status: 400 });
  }

  if (email === normalizeEmail(user.email ?? '')) {
    return NextResponse.json({ error: 'cannot_invite_self' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: pod } = await admin
    .from('mini_pods')
    .select('id, name, created_by')
    .eq('id', podId)
    .eq('created_by', user.id)
    .maybeSingle();
  if (!pod) return NextResponse.json({ error: 'pod_not_owned' }, { status: 403 });

  // Daily volume guard
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: dayCount } = await admin
    .from('pod_invites')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', user.id)
    .gte('created_at', dayStart.toISOString());
  if ((dayCount ?? 0) >= MAX_INVITES_PER_DAY) {
    return NextResponse.json(
      {
        error: 'invite_daily_limit',
        detail: `You can send up to ${MAX_INVITES_PER_DAY} invitations per day to keep email volume low and intentional.`,
      },
      { status: 429 }
    );
  }

  const { count: pendingCount } = await admin
    .from('pod_invites')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', podId)
    .eq('status', 'pending');
  if ((pendingCount ?? 0) >= MAX_PENDING_PER_POD) {
    return NextResponse.json(
      {
        error: 'invite_pod_limit',
        detail: `This pod already has ${MAX_PENDING_PER_POD} pending invitations.`,
      },
      { status: 429 }
    );
  }

  // If invitee already has access, short-circuit
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .limit(1);
  // profiles table may not store email; rely on auth lookup via admin if available.
  // Pending invite is still the source of truth for not-yet-signed-up users.

  const token = randomBytes(24).toString('hex');
  const { data: invite, error } = await admin
    .from('pod_invites')
    .upsert(
      {
        pod_id: podId,
        invited_email: email,
        invited_by: user.id,
        can_direct: canDirect,
        status: 'pending',
        token,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
      },
      { onConflict: 'pod_id,invited_email' }
    )
    .select('id, pod_id, invited_email, can_direct, status, token, created_at, expires_at')
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'invite_create_failed', detail: error?.message }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const inviteUrl = `${origin}/invite/${invite.token}`;

  const emailResult = await sendInviteEmail({
    to: email,
    podName: pod.name,
    inviterEmail: user.email ?? 'A Brainpod Director',
    inviteUrl,
  });

  return NextResponse.json({
    invite: {
      id: invite.id,
      pod_id: invite.pod_id,
      invited_email: invite.invited_email,
      can_direct: invite.can_direct,
      status: invite.status,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
    },
    invite_url: inviteUrl,
    email: emailResult,
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await request.json();
  if (typeof id !== 'string') return NextResponse.json({ error: 'invalid_invite' }, { status: 400 });

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('pod_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('invited_by', user.id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: 'invite_revoke_failed', detail: error?.message }, { status: 500 });
  }
  return NextResponse.json({ invite: updated });
}
