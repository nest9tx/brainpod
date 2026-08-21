'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AcceptInviteButton({
  token,
  expectedEmail,
  userEmail,
}: {
  token: string;
  expectedEmail: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const emailMatches = userEmail.trim().toLowerCase() === expectedEmail.trim().toLowerCase();

  async function accept() {
    setStatus('working');
    setMessage('');
    try {
      const res = await fetch('/api/workspace/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.detail ?? data.error ?? 'Could not accept the invitation.');
        return;
      }
      router.push(`/?pod=${data.pod.id}`);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Could not accept the invitation.');
    }
  }

  if (!emailMatches) {
    return (
      <p className="text-sm text-calm-muted">
        You are signed in as {userEmail}. Sign in with {expectedEmail} to accept this invitation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={accept}
        disabled={status === 'working'}
        className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
      >
        {status === 'working' ? 'Accepting…' : 'Accept invitation'}
      </button>
      {message && <p className="text-sm text-red-400">{message}</p>}
    </div>
  );
}
