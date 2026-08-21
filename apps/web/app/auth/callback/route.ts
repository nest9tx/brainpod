import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // Never dump a successful sign-in back onto the login screen
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login#')) {
    return '/';
  }
  return raw;
}

// Exchanges the magic-link / OAuth code for a session, then ensures a profiles row
// exists for this human (native agent profiles are seeded separately).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('auth callback exchange failed:', error.message);
      return NextResponse.redirect(new URL('/login?error=auth_callback', request.url));
    }

    if (data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          display_name: data.user.email?.split('@')[0] ?? 'Director',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
