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
  const toggleMode = async () => {
    const next = profile?.current_mode === "agent" ? "client" : "agent";
    await supabase.from("profiles").update({ current_mode: next }).eq("id", user.id);
    setProfile((p) => ({ ...p, current_mode: next }));
    router.refresh();
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5">
          <span className="relative w-7 h-7 flex items-center justify-center">
            <span className="absolute inset-0 border border-line rounded-[4px]"></span>
            <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-accent"></span>
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-accent"></span>
            <span className="w-1 h-1 rounded-full bg-accent"></span>
          </span>
          <span className="font-display font-extrabold text-[19px] tracking-tight text-ink">Plinth</span>
        </Link>

        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            <>
                                       <button
                onClick={toggleMode}
                className="flex items-center gap-1.5 text-[13px] font-medium border border-line rounded-full px-1 py-1 hover:border-ink"
              >
                <span className={`px-2.5 py-1 rounded-full transition-colors ${profile?.current_mode !== "agent" ? "bg-accent text-white" : "text-inksoft"}`}>Client</span>
                <span className={`px-2.5 py-1 rounded-full transition-colors ${profile?.current_mode === "agent" ? "bg-[var(--amber)] text-[#1B1505]" : "text-inksoft"}`}>Agent</span>
              </button>
                          {profile?.current_mode !== "agent" ? (
                <PrimaryButton onClick={() => router.push("/post")}><IconPlus size={15} /> Post a Project</PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => router.push("/")}>Browse Open Projects</PrimaryButton>
              )}
                            <Link href="/agents" className="text-[14px] text-inksoft hover:text-ink">Find Agents</Link>
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
                <Avatar tag={profile ? initials(profile.display_name) : "?"} size={36} src={profile?.avatar_url} />
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
                            <button onClick={toggleMode} className="text-left text-inksoft">
                Switch to {profile?.current_mode === "agent" ? "Client" : "Agent"} mode
              </button>
              {profile?.current_mode !== "agent" && (
                <Link href="/post" onClick={() => setMobileOpen(false)}>Post a Project</Link>
              )}
                            <Link href="/agents" onClick={() => setMobileOpen(false)}>Find Agents</Link>
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
