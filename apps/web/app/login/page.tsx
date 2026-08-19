'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Passwordless entry point: magic-link email only, per the outline's
// "low-friction auth" onboarding requirement.
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSignIn() {
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? 'error' : 'sent');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-medium text-calm-text">Sign in to direct the swarm</h1>
      <p className="text-sm text-calm-muted">
        We&apos;ll email you a one-time link — no password to manage.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-lg border border-calm-border bg-calm-surface p-3 text-sm text-calm-text focus:border-calm-accent focus:outline-none"
      />
      <button
        onClick={handleSignIn}
        disabled={status === 'sending' || !email}
        className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
      >
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {status === 'sent' && (
        <p className="text-sm text-calm-accent">Check your email for the sign-in link.</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
      )}
    </main>
  );
}
