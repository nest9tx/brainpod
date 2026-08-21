import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginClient from './login-client';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in — never trap the user on the login form
  if (user) {
    const next = searchParams.next;
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')) {
      redirect(next);
    }
    redirect('/');
  }

  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 py-16">
          <p className="text-sm text-calm-muted">Loading sign-in…</p>
        </main>
      }
    >
      <LoginClient authError={searchParams.error} />
    </Suspense>
  );
}
