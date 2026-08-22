import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stripe webhook: activate / deactivate Sustaining Membership on profiles.role.
 * Configure endpoint: https://www.brainpod.org/api/membership/webhook
 * Events: checkout.session.completed, customer.subscription.deleted, customer.subscription.updated
 *
 * On activation, today's prompt_count is reset so free-tier usage earlier the same
 * day does not consume the Sustaining allotment.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (webhookSecret && !sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
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

    // Fresh paid allotment for the rest of the UTC day.
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
