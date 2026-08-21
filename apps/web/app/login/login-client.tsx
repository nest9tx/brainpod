'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default function LoginClient({ authError }: { authError?: string }) {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState(
    authError === 'auth_callback'
      ? 'Sign-in could not be completed. Please try Google or email again.'
      : ''
  );

  function redirectTarget() {
    if (
      nextPath.startsWith('/') &&
      !nextPath.startsWith('//') &&
      !nextPath.startsWith('/login')
    ) {
      return nextPath;
    }
    return '/';
  }

  async function handleSignIn() {
    setStatus('sending');
    setErrorMessage('');
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
    setErrorMessage('');
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
        <h1 className="text-xl font-medium text-calm-text">Sign in to Brainpod</h1>
        <p className="text-sm leading-relaxed text-calm-muted">
          Brainpod is a public-benefit application for human-directed collaboration with AI agent
          teams. Sign in to open your Orientation Mini-Pod, direct research and construction cycles,
          and keep private work private until you choose to release a summary.
        </p>
      </div>

      <div className="space-y-2 border-t border-calm-border pt-4">
        <p className="text-sm leading-relaxed text-calm-muted">
          Google sign-in is used only to authenticate your account (email and basic profile). Brainpod
          does not access Gmail, Drive, contacts, or other Google services. Email magic links are an
          alternative that also only establish your Brainpod session and daily free-prompt count.
        </p>
      </div>

      <p className="text-center text-sm text-calm-muted">
        Prefer to look around first?{' '}
        <Link href="/explore" className="underline hover:text-calm-text">
          Explore released work
        </Link>
        {' · '}
        <Link href="/" className="underline hover:text-calm-text">
          Brainpod home
        </Link>
      </p>

      <div id="sign-in" className="space-y-3 border-t border-calm-border pt-6">
        <button
          onClick={handleGoogleSignIn}
          className="w-full rounded-lg border border-calm-border bg-calm-surface px-4 py-2 text-sm font-medium text-calm-text hover:border-calm-accent"
        >
          Continue with Google
        </button>
        <p className="text-xs text-calm-muted">
          Authenticates you with Google and returns you to Brainpod. No Google content is read beyond
          basic account identity.
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
            Link sent. Open it from this device to continue into Brainpod.
          </p>
        )}
        {(status === 'error' || errorMessage) && (
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
