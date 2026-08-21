'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SiteNavProps = {
  variant?: 'public' | 'app';
  userEmail?: string;
};

export default function SiteNav({ variant = 'public', userEmail }: SiteNavProps) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <nav className="flex items-center justify-between gap-4 text-xs text-calm-muted">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={variant === 'app' ? '/' : '/'} className="font-medium text-calm-text hover:text-calm-accent">
          Brainpod
        </Link>
        {variant === 'app' ? (
          <>
            <Link href="/" className="underline hover:text-calm-text">
              Current pod
            </Link>
            <Link href="/workspace" className="underline hover:text-calm-text">
              Workspace
            </Link>
            <Link href="/explore" className="underline hover:text-calm-text">
              Explore
            </Link>
          </>
        ) : (
          <>
            <Link href="/explore" className="underline hover:text-calm-text">
              Explore
            </Link>
            <Link href="/login" className="underline hover:text-calm-text">
              Enter
            </Link>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {variant === 'app' && userEmail && <span className="hidden sm:inline">{userEmail}</span>}
        {variant === 'app' ? (
          <button onClick={handleSignOut} className="underline hover:text-calm-text">
            Sign out
          </button>
        ) : (
          <Link href="/login" className="underline hover:text-calm-text">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
