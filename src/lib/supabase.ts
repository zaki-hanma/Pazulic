import { createClient } from "@supabase/supabase-js";

// Öffentliche Schlüssel (dürfen im Code stehen). Die Daten schützt die Datenbank selbst (Row Level Security).
const SUPABASE_URL = "https://lrjwjbtnofcnbhgfqubs.supabase.co";
const SUPABASE_KEY = "sb_publishable_JCmgxn_9mXdTZrhMTsdRiw_LnB2AVk4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
