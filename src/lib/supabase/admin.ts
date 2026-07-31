import { createClient } from "@supabase/supabase-js";

export function createAdminClient(url?: string, key?: string) {
  const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = key || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
