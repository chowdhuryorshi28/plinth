"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { Avatar, initials } from "./ui";

export default function ChatWidget() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  // unread badge, checked periodically
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

  // load thread list when panel opens
  useEffect(() => {
    if (!open || !user || activeThread) return;
    supabase
      .from("threads")
      .select(`*, owner:profiles!threads_owner_id_fkey(display_name), helper:profiles!threads_helper_id_fkey(display_name), projects(title)`)
      .or(`owner_id.eq.${user.id},helper_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => setThreads(data || []));
  }, [open, user, activeThread]);

  // active thread: messages + realtime + typing
  useEffect(() => {
    if (!activeThread || !user) return;

    const loadMessages = () => {
      supabase.from("messages").select("*").eq("thread_id", activeThread.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
    };
    loadMessages();
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

    return () => supabase.removeChannel(channel);
  }, [activeThread, user]);

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
        thread_id: activeThread.id,
        sender_id: user.id,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
      });
    }
  }

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!user) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[340px] h-[440px] bg-surface border border-line rounded-[10px] shadow-2xl flex flex-col overflow-hidden">
          {/* header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0 bg-paperdim">
            {activeThread ? (
              <>
                <button onClick={() => setActiveThread(null)} className="text-inksoft hover:text-ink text-[15px]">←</button>
                <Avatar tag={initials(
                  (activeThread.owner_id === user.id ? activeThread.helper?.display_name : activeThread.owner?.display_name) || "Agent"
                )} size={24} />
                <span className="text-[13px] font-medium text-ink truncate">
                  {(activeThread.owner_id === user.id ? activeThread.helper?.display_name : activeThread.owner?.display_name) || "Agent"}
                </span>
              </>
            ) : (
              <span className="text-[13.5px] font-medium text-ink">Messages</span>
            )}
            <button onClick={() => setOpen(false)} className="ml-auto text-inksoft hover:text-ink text-[15px]">✕</button>
          </div>

          {/* body */}
          {!activeThread ? (
            <div className="flex-1 overflow-y-auto divide-y divide-line">
              {threads.length === 0 && (
                <p className="text-[13px] text-inksoft text-center mt-10 px-4">No conversations yet.</p>
              )}
              {threads.map((t) => {
                const otherName = t.owner_id === user.id ? t.helper?.display_name : t.owner?.display_name;
                return (
                  <button key={t.id} onClick={() => setActiveThread(t)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-paperdim/60">
                    <Avatar tag={initials(otherName || "Agent")} size={28} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-ink truncate">{otherName || "Agent"}</div>
                      <div className="text-[11px] text-inksoft truncate">{t.projects?.title}</div>
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
                      {fileUrl ? (
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
                      <span className="text-[9.5px] text-inksoft mt-0.5 px-0.5">{fmtTime(m.created_at)}</span>
                    </div>
                  );
                })}
                {otherTyping && (
                  <div className="text-[11px] text-inksoft px-1">typing…</div>
                )}
                <div ref={bottomRef}></div>
              </div>
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

      {/* floating launcher button */}
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