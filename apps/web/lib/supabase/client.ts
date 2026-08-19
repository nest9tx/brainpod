'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client, always uses the anon key (RLS-gated), never the
// service-role key. Safe to import from client components.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
