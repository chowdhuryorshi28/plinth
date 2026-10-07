"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { Avatar, PrimaryButton, IconPlus, IconMenu, IconX, IconBell, IconChat, initials } from "./ui";
import { useOnline } from "../lib/presence";
import Link from "next/link";

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
 
  const [user, setUser] = useState(null);   // the Supabase auth user (or null)
  const [profile, setProfile] = useState(null); // our own "profiles" row for that user
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const isOnline = useOnline(user?.id);

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
    useEffect(() => {
    if (!user) { setNotifications([]); setNotifUnread(0); return; }
    const loadNotifs = () => {
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setNotifications(data || []);
          setNotifUnread((data || []).filter((n) => !n.read_at).length);
        });
    };
    loadNotifs();
    const interval = setInterval(loadNotifs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  async function openNotif(n) {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setNotifications((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setNotifUnread((c) => Math.max(0, c - 1));
    }
    setNotifOpen(false);
    router.push(n.link || "/");
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    setNotifications((cur) => cur.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setNotifUnread(0);
  }

  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  };

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
              <Link href="/messages" className="relative text-inksoft hover:text-ink p-1" title="Messages" aria-label="Messages">
                <IconChat size={19} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
                            <div className="relative">
                <button onClick={() => setNotifOpen((o) => !o)} className="relative text-inksoft hover:text-ink p-1" title="Notifications" aria-label="Notifications">
                  <IconBell size={19} />
                  {notifUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {notifUnread > 9 ? "9+" : notifUnread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-line rounded-[6px] shadow-2xl z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-surface">
                      <span className="text-[13px] font-medium text-ink">Notifications</span>
                      {notifUnread > 0 && (
                        <button onClick={markAllRead} className="text-[11.5px] text-accent hover:underline">Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-[13px] text-inksoft text-center py-8">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => openNotif(n)}
                          className={`w-full text-left px-4 py-3 border-b border-line last:border-b-0 hover:bg-paperdim/60 ${!n.read_at ? "bg-accent/5" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0"></span>}
                            <div className="min-w-0">
                              <p className="text-[12.5px] text-ink leading-snug">{n.message}</p>
                              <p className="text-[10.5px] text-inksoft mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Link href="/profile" className="flex items-center gap-1.5">
                <Avatar tag={profile ? initials(profile.display_name) : "?"} size={36} src={profile?.avatar_url} />
                {isOnline && <span className="w-2 h-2 rounded-full bg-emerald-500" title="You're online"></span>}
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

        <div className="flex items-center gap-1 md:hidden">
          {user && (
            <>
              <Link href="/messages" className="relative text-ink p-1.5" title="Messages" aria-label="Messages">
                <IconChat size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-accent text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/notifications" className="relative text-ink p-1.5" title="Notifications" aria-label="Notifications">
                <IconBell size={20} />
                {notifUnread > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-accent text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {notifUnread > 9 ? "9+" : notifUnread}
                  </span>
                )}
              </Link>
            </>
          )}
          <button className="text-ink p-1.5" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>
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
