"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { Avatar, initials, money } from "./ui";

export default function ChatWidget() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [deal, setDeal] = useState(null);
  const [dealProjectTitle, setDealProjectTitle] = useState("");
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [projectCards, setProjectCards] = useState({});

  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    if (!user) return;
    const check = () => {
      supabase.from("messages").select("id", { count: "exact", head: true })
        .is("read_at", null).neq("sender_id", user.id)
        .then(({ count }) => setUnreadCount(count || 0));
    };
    check();
    const interval = setInterval(check, 8000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!open || !user || activeThread) return;
    supabase
      .from("threads")
      .select(`*, owner:profiles!threads_owner_id_fkey(display_name, avatar_url), helper:profiles!threads_helper_id_fkey(display_name, avatar_url), projects(title)`)
      .or(`owner_id.eq.${user.id},helper_id.eq.${user.id}`)
      .then(async ({ data }) => {
        const list = data || [];
        const withLast = await Promise.all(
          list.map(async (t) => {
            const { data: lastMsg } = await supabase
              .from("messages")
              .select("content, created_at, file_name, project_id")
              .eq("thread_id", t.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            return { ...t, lastMsg };
          })
        );
        withLast.sort((a, b) => {
          const at = a.lastMsg?.created_at || a.created_at;
          const bt = b.lastMsg?.created_at || b.created_at;
          return new Date(bt) - new Date(at);
        });
        setThreads(withLast);
      });
  }, [open, user, activeThread]);

  useEffect(() => {
    if (!activeThread || !user) return;

    const loadMessages = () => {
      supabase.from("messages").select("*").eq("thread_id", activeThread.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
    };
    const loadDeal = () => {
      supabase.from("deals").select("*").eq("thread_id", activeThread.id).maybeSingle()
        .then(({ data }) => {
          setDeal(data || null);
          if (data) {
            supabase.from("projects").select("title").eq("id", data.project_id).single()
              .then(({ data: proj }) => setDealProjectTitle(proj?.title || ""));
          }
        });
    };

    loadMessages();
    loadDeal();
    supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("thread_id", activeThread.id).neq("sender_id", user.id).is("read_at", null)
      .then(() => {});

    const channel = supabase
      .channel(`widget-thread-${activeThread.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${activeThread.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", payload.new.id).then(() => {});
          }
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id === user.id) return;
        setOtherTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 2500);
      })
      .subscribe();
    channelRef.current = channel;

    const dealInterval = setInterval(loadDeal, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dealInterval);
    };
  }, [activeThread, user]);

  useEffect(() => {
    if (!activeThread) return;
    const missingIds = [...new Set(messages.filter((m) => m.project_id).map((m) => m.project_id))]
      .filter((id) => !projectCards[id]);
    if (missingIds.length === 0) return;

    (async () => {
      for (const pid of missingIds) {
        const { data: proj } = await supabase.from("projects").select("id, title, category, budget, deadline, owner_id").eq("id", pid).single();
        if (!proj) continue;
        const { data: file } = await supabase.from("project_files").select("file_path").eq("project_id", pid).limit(1).maybeSingle();
        const imageUrl = file ? supabase.storage.from("project-files").getPublicUrl(file.file_path).data.publicUrl : null;
        const agentId = proj.owner_id === activeThread.owner_id ? activeThread.helper_id : activeThread.owner_id;
        const { data: offer } = await supabase.from("offers").select("*").eq("project_id", pid).eq("agent_id", agentId).maybeSingle();
        setProjectCards((cur) => ({ ...cur, [pid]: { ...proj, imageUrl, offer: offer || null } }));
      }
    })();
  }, [messages, activeThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !activeThread) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ thread_id: activeThread.id, sender_id: user.id, content });
  }

  async function sendFile(file) {
    if (!file || !activeThread) return;
    const path = `chat/${activeThread.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file);
    if (!error) {
      await supabase.from("messages").insert({
        thread_id: activeThread.id, sender_id: user.id,
        file_path: path, file_name: file.name, file_type: file.type,
      });
    }
  }

  async function acceptOfferForCard(card) {
    if (!card.offer || deal) return;
    const agentId = card.owner_id === activeThread.owner_id ? activeThread.helper_id : activeThread.owner_id;
    const { data, error } = await supabase.from("deals").insert({
      thread_id: activeThread.id, project_id: card.id,
      owner_id: card.owner_id, helper_id: agentId, amount: card.offer.amount,
    }).select().single();
    if (!error) {
      await supabase.from("threads").update({ status: "deal_accepted" }).eq("id", activeThread.id);
      await supabase.from("projects").update({ status: "in_progress" }).eq("id", card.id);
      setDeal(data);
      setDealProjectTitle(card.title);
      await supabase.from("offers").update({ status: "accepted" }).eq("id", card.offer.id);
      await supabase.from("offers").update({ status: "declined" })
        .eq("project_id", card.id).neq("id", card.offer.id).in("status", ["pending", "shortlisted"]);
    }
  }

  async function markComplete() {
    if (!deal) return;
    await supabase.from("deals").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", deal.id);
    await supabase.from("projects").update({ status: "completed" }).eq("id", deal.project_id);
    setDeal({ ...deal, status: "completed" });
  }
  const fmtListTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  };
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!user) return null;
  if (pathname?.startsWith("/messages")) return null;

  const dealIsOwner = deal && user.id === deal.owner_id;

  return (
    <div className="hidden sm:flex fixed bottom-5 right-5 z-50 flex-col items-end">
      {open && (
        <div className="mb-3 w-[calc(100vw-32px)] max-w-[340px] h-[70vh] max-h-[460px] bg-surface border border-line rounded-[10px] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0 bg-paperdim">
            {activeThread ? (
              <>
                <button onClick={() => setActiveThread(null)} className="text-inksoft hover:text-ink text-[15px]">←</button>
                <Avatar tag={initials(
                  (activeThread.owner_id === user.id ? activeThread.helper?.display_name : activeThread.owner?.display_name) || "Agent"
                )} size={24} src={activeThread.owner_id === user.id ? activeThread.helper?.avatar_url : activeThread.owner?.avatar_url} />
                <span className="text-[13px] font-medium text-ink truncate">
                  {(activeThread.owner_id === user.id ? activeThread.helper?.display_name : activeThread.owner?.display_name) || "Agent"}
                </span>
                <button
                  onClick={() => router.push(`/messages/${activeThread.id}`)}
                  className="ml-1 text-[10.5px] text-inksoft hover:text-accent shrink-0"
                  title="Open full chat"
                >
                  ↗
                </button>
              </>
            ) : (
              <span className="text-[13.5px] font-medium text-ink">Messages</span>
            )}
            <button onClick={() => setOpen(false)} className="ml-auto text-inksoft hover:text-ink text-[15px]">✕</button>
          </div>

          {!activeThread ? (
            <div className="flex-1 overflow-y-auto divide-y divide-line">
              {threads.length === 0 && (
                <p className="text-[13px] text-inksoft text-center mt-10 px-4">No conversations yet.</p>
              )}
              {threads.map((t) => {
                const otherName = t.owner_id === user.id ? t.helper?.display_name : t.owner?.display_name;
                const otherAvatar = t.owner_id === user.id ? t.helper?.avatar_url : t.owner?.avatar_url;
                return (
                    <button key={t.id} onClick={() => setActiveThread(t)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-paperdim/60">
                    <Avatar tag={initials(otherName || "Agent")} size={28} src={otherAvatar} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12.5px] font-medium text-ink truncate">{otherName || "Agent"}</span>
                        <span className="text-[9.5px] text-inksoft shrink-0">{fmtListTime(t.lastMsg?.created_at)}</span>
                      </div>
                      <div className="text-[11px] text-inksoft truncate mt-0.5">
                        {t.lastMsg ? (t.lastMsg.content || (t.lastMsg.project_id ? "📁 Shared a project" : t.lastMsg.file_name ? "📎 " + t.lastMsg.file_name : "")) : "No messages yet"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  const fileUrl = m.file_path ? supabase.storage.from("project-files").getPublicUrl(m.file_path).data.publicUrl : null;
                  const isImage = m.file_type?.startsWith("image/");
                  return (
                    <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {m.project_id ? (
                        <ProjectCardMini
                          card={projectCards[m.project_id]}
                          currentUserId={user.id}
                          deal={deal}
                          onClick={() => router.push(`/projects/${m.project_id}`)}
                          onAccept={acceptOfferForCard}
                        />
                      ) : fileUrl ? (
                        isImage ? (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="max-w-[75%] rounded-[7px] overflow-hidden border border-line">
                            <img src={fileUrl} alt={m.file_name} className="w-full max-h-40 object-cover" />
                          </a>
                        ) : (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 max-w-[80%] px-3 py-1.5 rounded-[7px] text-[12px] ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                            📄 <span className="truncate">{m.file_name}</span>
                          </a>
                        )
                      ) : (
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-[7px] text-[12.5px] leading-snug ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                          {m.content}
                        </div>
                      )}
                      {!m.project_id && (
                        <span className="text-[9.5px] text-inksoft mt-0.5 px-0.5">{fmtTime(m.created_at)}</span>
                      )}
                    </div>
                  );
                })}
                {otherTyping && (
                  <div className="text-[11px] text-inksoft px-1">typing…</div>
                )}
                <div ref={bottomRef}></div>
              </div>

              {deal && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-line shrink-0 bg-paperdim/60 text-[11.5px]">
                  <span className="text-ink truncate">
                    ✓ {money(deal.amount)} · {dealProjectTitle}
                  </span>
                  {dealIsOwner && deal.status !== "completed" && (
                    <button onClick={markComplete} className="shrink-0 text-accent font-medium hover:underline">
                      Mark Complete
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-line shrink-0">
                <input
                  type="file"
                  id="widgetFileInput"
                  className="hidden"
                  onChange={(e) => { if (e.target.files[0]) sendFile(e.target.files[0]); e.target.value = ""; }}
                />
                <label htmlFor="widgetFileInput" className="shrink-0 w-9 h-9 rounded-full border border-line flex items-center justify-center cursor-pointer text-inksoft hover:text-ink hover:border-ink text-[15px]">
                  📎
                </label>
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    const now = Date.now();
                    if (channelRef.current && now - lastTypingSentRef.current > 1500) {
                      lastTypingSentRef.current = now;
                      channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Message…"
                  className="flex-1 h-9 px-3 rounded-full border border-line text-[12.5px] text-ink"
                />
                <button onClick={sendMessage} className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center text-[13px]">→</button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-press relative w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center text-[22px] shadow-xl hover:bg-accent"
      >
        {open ? "✕" : "💬"}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

function ProjectCardMini({ card, currentUserId, deal, onClick, onAccept }) {
  if (!card) {
    return <div className="w-56 h-20 rounded-[7px] border border-line bg-paperdim animate-pulse"></div>;
  }
  const isOwnerHere = currentUserId === card.owner_id;
  const dealIsForThisCard = deal && deal.project_id === card.id;
  const canAccept = isOwnerHere && card.offer && ["pending", "shortlisted"].includes(card.offer.status) && !deal;

  return (
    <div className="w-56 rounded-[7px] border border-line bg-surface overflow-hidden">
      <button onClick={onClick} className="text-left w-full block">
        {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="w-full h-16 object-cover" />}
        <div className="p-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9.5px] text-inksoft bg-paperdim px-1.5 py-0.5 rounded-[3px] border border-line">{card.category}</span>
            <span className="text-[11px] font-mono text-accent font-semibold">{money(card.budget)}</span>
          </div>
          <h4 className="font-display font-semibold text-[12px] text-ink leading-snug">{card.title}</h4>
        </div>
      </button>
      {dealIsForThisCard && (
        <div className="px-2 py-1.5 border-t border-line text-[10.5px] text-accent font-medium">
          {deal.status === "completed" ? "✓ Deal completed" : "✓ Deal accepted"}
        </div>
      )}
      {canAccept && (
        <button
          onClick={() => onAccept(card)}
                   className="w-full bg-ink text-paper hover:bg-accent font-medium text-[11px] px-2 py-2 border-t border-line"
        >
          Accept — {money(card.offer.amount)} (10%)
        </button>
      )}
    </div>
  );
}