"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { Avatar, PrimaryButton, IconPlus, IconMenu, IconX, initials } from "./ui";

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(null);   // the Supabase auth user (or null)
  const [profile, setProfile] = useState(null); // our own "profiles" row for that user
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Ask Supabase "who is logged in right now?" once on load...
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    // ...and keep listening in case they log in/out in this tab.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", user.id).single()
      .then(({ data }) => setProfile(data || null));
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const checkUnread = () => {
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .neq("sender_id", user.id)
        .then(({ count }) => setUnreadCount(count || 0));
    };
    checkUnread();
    const interval = setInterval(checkUnread, 8000);
    return () => clearInterval(interval);
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative w-7 h-7 flex items-center justify-center rounded-[4px] border border-line">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
          </span>
          <span className="font-display font-extrabold text-[19px] tracking-tight text-ink">Plinth</span>
        </Link>

        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <PrimaryButton onClick={() => router.push("/post")}><IconPlus size={15} /> Post a Project</PrimaryButton>
                                        <Link href="/dashboard" className="text-[14px] text-inksoft hover:text-ink">Dashboard</Link>
              <Link href="/messages" className="relative text-[14px] text-inksoft hover:text-ink">
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile">
                <Avatar tag={profile ? initials(profile.display_name) : "?"} size={36} />
              </Link>
              <button onClick={logout} className="text-[13px] text-inksoft hover:text-ink">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-[14px] text-inksoft hover:text-ink">Log in</Link>
              <PrimaryButton onClick={() => router.push("/signup")}>Sign up</PrimaryButton>
            </>
          )}
        </nav>

        <button className="md:hidden text-ink" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-paper px-5 py-4 flex flex-col gap-4">
          <Link href="/" onClick={() => setMobileOpen(false)}>Discover</Link>
          {user ? (
            <>
              <Link href="/post" onClick={() => setMobileOpen(false)}>Post a Project</Link>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link href="/messages" onClick={() => setMobileOpen(false)}>Messages</Link>
              <Link href="/profile" onClick={() => setMobileOpen(false)}>Profile</Link>
              <button onClick={logout} className="text-left text-inksoft">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
