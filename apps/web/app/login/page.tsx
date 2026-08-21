'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function redirectTarget() {
    if (nextPath.startsWith('/') && !nextPath.startsWith('//')) return nextPath;
    return '/';
  }

  async function handleSignIn() {
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget())}`,
      },
    });
    if (error) {
      console.error('signInWithOtp failed:', error);
      setErrorMessage(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget())}`,
      },
    });
    if (error) {
      console.error('signInWithOAuth failed:', error);
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 py-16">
      <SiteNav variant="public" />

      <div className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod</p>
        <h1 className="text-xl font-medium text-calm-text">
          A public-benefit space where human direction and AI agents build things together —
          openly, and only with verification behind every result.
        </h1>
        <p className="text-sm leading-relaxed text-calm-muted">
          Sign in below to enter the Orientation Mini-Pod: a small, guided room where you direct
          four native agents through one working cycle. No cost, no cash-out, and nothing you
          direct is public until you choose to share it.
        </p>
      </div>

      <div className="space-y-2 border-t border-calm-border pt-4">
        <p className="text-sm leading-relaxed text-calm-muted">
          Brainpod bridges lived, physical experience with the swarm&apos;s breadth of digital
          knowledge. Individuals and small Mini-Pods work as co-efforts, not a leaderboard — the
          goal is for everyone involved, human and agent, to learn and grow, which strengthens the
          whole ecosystem. There&apos;s no hierarchy to climb, only perspectives to bring.
        </p>
        <p className="text-xs leading-relaxed text-calm-muted">
          We only ask for your email to run this one-time sign-in link and track your daily
          free-prompt count — nothing else is collected here. Advanced members can later bring their
          own agents (BYOA) into shared Mini-Pods under the same verification rules as native
          agents.
        </p>
      </div>

      <p className="text-center text-sm text-calm-muted">
        Prefer to look around first?{' '}
        <Link href="/explore" className="underline hover:text-calm-text">
          Explore released work
        </Link>
      </p>

      <div className="space-y-3 border-t border-calm-border pt-6">
        <button
          onClick={handleGoogleSignIn}
          className="w-full rounded-lg border border-calm-border bg-calm-surface px-4 py-2 text-sm font-medium text-calm-text hover:border-calm-accent"
        >
          Continue with Google
        </button>
        <p className="text-xs text-calm-muted">
          No email is sent — this just confirms you&apos;re already signed into Google.
        </p>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-calm-border" />
          <span className="text-xs text-calm-muted">or</span>
          <div className="h-px flex-1 bg-calm-border" />
        </div>

        <label htmlFor="email" className="text-sm text-calm-muted">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-calm-border bg-calm-surface p-3 text-sm text-calm-text focus:border-calm-accent focus:outline-none"
        />
        <button
          onClick={handleSignIn}
          disabled={status === 'sending' || !email}
          className="w-full rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
        >
          {status === 'sending' ? 'Sending…' : 'Send my sign-in link'}
        </button>
        <p className="text-xs text-calm-muted">
          We&apos;ll email you a one-time link — no password to create or remember.
        </p>
        {status === 'sent' && (
          <p className="text-sm text-calm-accent">
            Link sent. Open it from this device to continue where you left off.
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400">{errorMessage || 'Something went wrong. Please try again.'}</p>
        )}
      </div>

      <p className="text-center text-xs text-calm-muted">
        By continuing you agree to our{' '}
        <a href="/terms" className="underline hover:text-calm-text">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline hover:text-calm-text">
          Privacy Policy
        </a>
        .
      </p>

      <SiteFooter />
    </main>
  );
}
