// This is the Supabase connection used on the SERVER
// (in server components, during page rendering) so the server
// knows whether a request is logged in, using the session cookie.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }); } catch (e) {}
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: "", ...options }); } catch (e) {}
        },
      },
    }
  );
}
