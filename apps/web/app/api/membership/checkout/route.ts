import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STRIPE_PRICE_SUSTAINING } from '@/lib/tiers';

/**
 * Creates a Stripe Checkout Session for Sustaining Membership.
 * Production: STRIPE_SECRET_KEY must be the live secret (sk_live_…)
 * and STRIPE_PRICE_SUSTAINING should match the live price if not using the default.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      {
        error: 'stripe_not_configured',
        detail:
          'STRIPE_SECRET_KEY is not set. Add the live secret from Stripe Dashboard → Developers → API keys, then redeploy.',
      },
      { status: 503 }
    );
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.brainpod.org').replace(
    /\/$/,
    ''
  );

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', `${siteUrl}/workspace?membership=success`);
  body.set('cancel_url', `${siteUrl}/workspace?membership=cancelled`);
  body.set('client_reference_id', user.id);
  body.set('customer_email', user.email ?? '');
  body.set('line_items[0][price]', STRIPE_PRICE_SUSTAINING);
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[profile_id]', user.id);
  body.set('metadata[brainpod_tier]', 'sustaining_member');
  body.set('subscription_data[metadata][profile_id]', user.id);
  body.set('subscription_data[metadata][brainpod_tier]', 'sustaining_member');
  body.set('allow_promotion_codes', 'true');
  body.set('managed_payments[enabled]', 'false');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      { error: 'checkout_failed', detail: data.error?.message ?? 'Stripe error' },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: data.url, id: data.id });
}
