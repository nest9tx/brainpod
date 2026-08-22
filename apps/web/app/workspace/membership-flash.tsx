'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MembershipFlash({
  status,
}: {
  status?: 'success' | 'cancelled' | string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(status));

  useEffect(() => {
    if (!status) return;
    setVisible(true);
    // Clean the query string so a refresh does not re-show the banner.
    router.replace('/workspace', { scroll: false });
  }, [status, router]);

  if (!visible || !status) return null;

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-calm-accent/40 bg-calm-accent/10 px-4 py-3 text-sm text-calm-text">
        <p className="font-medium text-calm-accent">Checkout completed</p>
        <p className="mt-1 text-calm-muted">
          Thank you for sustaining the commons. When the Stripe webhook is connected, your tier and
          daily prompt allotment update automatically (and free usage from earlier today does not
          reduce the Sustaining count). Until then, operators can activate the role in Supabase.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="mt-2 text-xs text-calm-muted underline hover:text-calm-text"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="rounded-xl border border-calm-border bg-calm-surface/80 px-4 py-3 text-sm text-calm-muted">
        <p className="font-medium text-calm-text">Checkout cancelled</p>
        <p className="mt-1">
          No charge was made. You remain on the public-benefit free tier. You can start again anytime
          from Membership below.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="mt-2 text-xs text-calm-muted underline hover:text-calm-text"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
