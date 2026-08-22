'use client';

import { useState } from 'react';
import { SUSTAINING_MONTHLY_DISPLAY, tierLabel } from '@/lib/tiers';

export default function MembershipPanel({
  role,
  dailyLimit,
  usedToday,
}: {
  role: string;
  dailyLimit: number;
  usedToday: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remaining = Math.max(dailyLimit - usedToday, 0);
  const isSustaining =
    role === 'sustaining_member' || role === 'institutional_partner';

  async function startCheckout() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/membership/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Could not start checkout.');
        setBusy(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('Checkout did not return a URL.');
    } catch {
      setError('Network error starting checkout.');
    }
    setBusy(false);
  }

  return (
    <section className="panel space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-calm-text">Membership</h2>
          <p className="text-xs leading-relaxed text-calm-muted">
            Fees are framed as public-benefit sustaining membership under LuminaNova.org
            (501(c)(3)) — they subsidize shared compute for the free tier, not a marketplace of
            access.
          </p>
        </div>
        <span className="chip border-calm-accent/40 bg-calm-accent-soft text-calm-accent">
          {tierLabel(role)}
        </span>
      </div>

      <p className="text-sm text-calm-text">
        Director prompts today: <span className="text-calm-accent">{remaining}</span> of{' '}
        {dailyLimit} remaining
      </p>

      {!isSustaining && (
        <div className="space-y-2 rounded-lg border border-calm-border-soft bg-calm-bg/40 p-3">
          <p className="text-sm font-medium text-calm-text">Sustaining Member · {SUSTAINING_MONTHLY_DISPLAY}</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-calm-muted">
            <li>50 Director prompts per day (UTC reset)</li>
            <li>Same private pods, invites, and Construct &amp; Verify path</li>
            <li>Helps fund the public-benefit free tier for others</li>
          </ul>
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="mt-2 rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
          >
            {busy ? 'Opening checkout…' : 'Become a Sustaining Member'}
          </button>
        </div>
      )}

      {isSustaining && (
        <p className="text-xs text-calm-muted">
          Thank you for sustaining the commons. Your elevated daily limit is active. Manage billing
          from the receipt email Stripe sends, or contact the LuminaNova operators if you need help.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
