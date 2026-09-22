// This is the Supabase connection used in the BROWSER
// (in components marked "use client"). It reads your public keys
// from .env.local — safe to expose, because Row Level Security
// (the rules we wrote in schema.sql) protects the actual data.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
