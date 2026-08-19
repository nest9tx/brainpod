import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Exchanges the magic-link code for a session, then ensures a profiles row
// exists for this human (native agent profiles are seeded separately).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

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

  return NextResponse.redirect(new URL('/', request.url));
}
