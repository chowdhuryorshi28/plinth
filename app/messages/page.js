"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Avatar, initials } from "../../components/ui";

export default function MessagesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("threads")
      .select(`
        *,
        projects(title, owner_id),
        owner:profiles!threads_owner_id_fkey(display_name),
        helper:profiles!threads_helper_id_fkey(display_name)
      `)
      .or(`owner_id.eq.${user.id},helper_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = data || [];
        // attach last message + unread count for each thread
        const withMeta = await Promise.all(
          list.map(async (t) => {
            const { data: lastMsg } = await supabase
              .from("messages")
              .select("content, created_at")
              .eq("thread_id", t.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const { count: unread } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("thread_id", t.id)
              .neq("sender_id", user.id)
              .is("read_at", null);
            return { ...t, lastMsg, unread: unread || 0 };
          })
        );
        setThreads(withMeta);
      });
  }, [user]);

  if (user === undefined) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  if (!user) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Log in to see your messages.</div>;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <h1 className="font-display font-extrabold text-[26px] text-ink mb-6">Messages</h1>

      {threads.length === 0 && (
        <p className="text-[13.5px] text-inksoft">No conversations yet.</p>
      )}

      <div className="border border-line rounded-[6px] bg-surface divide-y divide-line overflow-hidden">
        {threads.map((t) => {
          const isOwner = t.owner_id === user.id;
          const otherName = isOwner ? t.helper?.display_name : t.owner?.display_name;
          return (
            <button
              key={t.id}
              onClick={() => router.push(`/messages/${t.id}`)}
              className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-paperdim/60 transition-colors"
            >
              <Avatar tag={initials(otherName || "Agent")} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{otherName || "Agent"}</span>
                  {t.status === "deal_accepted" && (
                    <span className="text-[10.5px] text-accent font-medium">· Deal accepted</span>
                  )}
                </div>
                <div className="text-[12px] text-inksoft truncate">{t.projects?.title}</div>
                {t.lastMsg && (
                  <div className="text-[12.5px] text-inksoft truncate mt-0.5">{t.lastMsg.content}</div>
                )}
              </div>
              {t.unread > 0 && (
                <span className="shrink-0 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {t.unread > 9 ? "9+" : t.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}