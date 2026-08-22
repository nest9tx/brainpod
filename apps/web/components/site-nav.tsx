'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type SiteNavProps = {
  variant?: 'public' | 'app';
  userEmail?: string;
};

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'text-calm-text'
          : 'text-calm-muted hover:text-calm-text'
      }
    >
      {children}
    </Link>
  );
}

export default function SiteNav({ variant = 'public', userEmail }: SiteNavProps) {
  const pathname = usePathname();
  const onLogin = pathname === '/login';
  const onWorkspace = pathname?.startsWith('/workspace');
  const onExplore = pathname?.startsWith('/explore');
  const onHome = pathname === '/' || pathname?.startsWith('/?');

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <nav className="flex items-center justify-between gap-4 border-b border-calm-border-soft pb-4 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-calm-border bg-calm-surface-elevated text-xs font-semibold text-calm-accent shadow-glow">
            B
          </span>
          <span className="font-medium text-calm-text group-hover:text-calm-accent">
            Brainpod
          </span>
        </Link>
        {variant === 'app' ? (
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <NavLink href="/" active={!!onHome && !onWorkspace && !onExplore}>
              Current pod
            </NavLink>
            <NavLink href="/workspace" active={!!onWorkspace}>
              Workspace
            </NavLink>
            <NavLink href="/explore" active={!!onExplore}>
              Explore
            </NavLink>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <NavLink href="/explore" active={!!onExplore}>
              Explore
            </NavLink>
            {!onLogin && (
              <NavLink href="/login">Enter</NavLink>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 text-xs sm:gap-4 sm:text-sm">
        {variant === 'app' && userEmail && (
          <span className="hidden max-w-[10rem] truncate text-calm-muted sm:inline">
            {userEmail}
          </span>
        )}
        {variant === 'app' ? (
          <button
            onClick={handleSignOut}
            className="text-calm-muted underline hover:text-calm-text"
          >
            Sign out
          </button>
        ) : onLogin ? (
          <a href="#sign-in" className="text-calm-muted underline hover:text-calm-text">
            Sign in below
          </a>
        ) : (
          <Link href="/login" className="text-calm-muted underline hover:text-calm-text">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
