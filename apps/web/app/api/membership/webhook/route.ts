import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stripe webhook: activate / deactivate Sustaining Membership.
 * Endpoint: https://www.brainpod.org/api/membership/webhook
 * Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
 *
 * Live requires STRIPE_WEBHOOK_SECRET (whsec_…) from the Dashboard endpoint.
 * On activation, today's prompt_count resets so free usage does not consume the paid allotment.
 */

function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): boolean {
  const items = header.split(',').map((part) => part.trim());
  const timestamp = items.find((p) => p.startsWith('t='))?.slice(2);
  const signature = items.find((p) => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !signature) return false;

  // Reject timestamps older than 5 minutes
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  // Live keys must always verify. Test keys may run without a secret only in early sandbox.
  const isLiveKey = secret.startsWith('sk_live');
  if (isLiveKey && !webhookSecret) {
    return NextResponse.json({ error: 'webhook_secret_required_for_live' }, { status: 503 });
  }
  if (webhookSecret) {
    if (!sig || !verifyStripeSignature(payload, sig, webhookSecret)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }
  }

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };

  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const obj = event.data?.object ?? {};
  const today = new Date().toISOString().slice(0, 10);

  async function activateSustaining(profileId: string, customerId?: string) {
    await admin
      .from('profiles')
      .update({
        role: 'sustaining_member',
        membership_status: 'active',
        stripe_customer_id: customerId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    await admin.from('daily_usage_logs').upsert(
      {
        profile_id: profileId,
        usage_date: today,
        prompt_count: 0,
      },
      { onConflict: 'profile_id,usage_date' }
    );
  }

  async function deactivateMembership(profileId?: string, customerId?: string) {
    if (profileId) {
      await admin
        .from('profiles')
        .update({
          role: 'free_public',
          membership_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
      return;
    }
    if (customerId) {
      await admin
        .from('profiles')
        .update({
          role: 'free_public',
          membership_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
    }
  }

  if (event.type === 'checkout.session.completed') {
    const profileId =
      (obj.client_reference_id as string) ||
      ((obj.metadata as Record<string, string> | undefined)?.profile_id);
    const customerId = obj.customer as string | undefined;
    if (profileId) {
      await activateSustaining(profileId, customerId);
    }
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    (event.type === 'customer.subscription.updated' &&
      (obj.status === 'canceled' || obj.status === 'unpaid'))
  ) {
    const profileId = (obj.metadata as Record<string, string> | undefined)?.profile_id;
    const customerId = obj.customer as string | undefined;
    await deactivateMembership(profileId, customerId);
  }

  if (
    event.type === 'customer.subscription.updated' &&
    (obj.status === 'active' || obj.status === 'trialing')
  ) {
    const profileId = (obj.metadata as Record<string, string> | undefined)?.profile_id;
    const customerId = obj.customer as string | undefined;
    if (profileId) {
      await activateSustaining(profileId, customerId);
    }
  }

  return NextResponse.json({ received: true });
}
