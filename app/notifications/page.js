"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setNotifications(data || []));
  }, [user]);

  async function openNotif(n) {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setNotifications((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    router.push(n.link || "/");
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    setNotifications((cur) => cur.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }

  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (user === undefined) return <div className="max-w-2xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  if (!user) return <div className="max-w-2xl mx-auto px-5 py-16 text-inksoft">Log in to see your notifications.</div>;

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-extrabold text-[26px] text-ink">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[13px] text-accent hover:underline">Mark all read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-[13.5px] text-inksoft">No notifications yet.</p>
      ) : (
        <div className="border border-line rounded-[6px] bg-surface divide-y divide-line overflow-hidden">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => openNotif(n)}
              className={`w-full text-left px-5 py-4 hover:bg-paperdim/60 ${!n.read_at ? "bg-accent/5" : ""}`}
            >
              <div className="flex items-start gap-3">
                {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0"></span>}
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink leading-snug">{n.message}</p>
                  <p className="text-[11px] text-inksoft mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}