import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client for server-only, trusted writes (e.g. inserting agent-authored
// pod_turns whose sender_id is a native agent, not the signed-in human). Never import
// this from a client component or anywhere that ships to the browser bundle.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
