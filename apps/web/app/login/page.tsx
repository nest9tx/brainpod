import { Suspense } from 'react';
import LoginClient from './login-client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 py-16">
          <p className="text-sm text-calm-muted">Loading sign-in…</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
