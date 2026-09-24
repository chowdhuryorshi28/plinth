"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { Avatar, Pill, money, initials, IconArrowLeft } from "../../../components/ui";

export default function ChatDetailPage() {
  const { threadId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(undefined);
  const [thread, setThread] = useState(undefined);
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [deal, setDeal] = useState(null);
   const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    supabase
      .from("threads")
      .select(`
        *,
        owner:profiles!threads_owner_id_fkey(display_name),
        helper:profiles!threads_helper_id_fkey(display_name)
      `)
      .eq("id", threadId)
      .single()
      .then(({ data }) => setThread(data || null));
  }, [threadId]);

  useEffect(() => {
    if (!thread) return;
    supabase.from("projects").select("*").eq("id", thread.project_id).single()
      .then(({ data }) => setProject(data || null));
  }, [thread]);

  useEffect(() => {
    if (!thread || !user) return;

    const loadMessages = () => {
      supabase.from("messages").select("*").eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
    };
    const loadDeal = () => {
      supabase.from("deals").select("*").eq("thread_id", thread.id).maybeSingle()
        .then(({ data }) => setDeal(data || null));
    };

    loadMessages();
    loadDeal();
    supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id).neq("sender_id", user.id).is("read_at", null)
      .then(() => {});

       // real-time: new messages appear instantly instead of waiting on a poll
    const channel = supabase
      .channel(`thread-${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${thread.id}` },
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

    // deals still poll lightly, since accept/complete are rare events
    const dealInterval = setInterval(loadDeal, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dealInterval);
    };
  }, [thread, user]);

  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // only auto-scroll if the user is already near the bottom (within ~120px)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

   async function sendMessage() {
    if (!text.trim() || !thread) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ thread_id: thread.id, sender_id: user.id, content });
  }

  async function sendFile(file) {
    if (!file || !thread) return;
    const path = `chat/${thread.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file);
    if (!error) {
      await supabase.from("messages").insert({
        thread_id: thread.id,
        sender_id: user.id,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
      });
    }
  }

  async function acceptOffer() {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    const { data, error } = await supabase.from("deals").insert({
      thread_id: thread.id, project_id: project.id,
      owner_id: thread.owner_id, helper_id: thread.helper_id, amount: amt,
    }).select().single();
    if (!error) {
      await supabase.from("threads").update({ status: "deal_accepted" }).eq("id", thread.id);
      await supabase.from("projects").update({ status: "in_progress" }).eq("id", project.id);
      setThread({ ...thread, status: "deal_accepted" });
      setDeal(data);
    }
  }

  async function markComplete() {
    if (!deal) return;
    await supabase.from("deals").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", deal.id);
    await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
    setDeal({ ...deal, status: "completed" });
  }

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (user === undefined || thread === undefined || !project) {
    return <div className="max-w-6xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  }
  if (!thread || !user || (user.id !== thread.owner_id && user.id !== thread.helper_id)) {
    return <div className="max-w-6xl mx-auto px-5 py-16 text-inksoft">Conversation not found.</div>;
  }

  const isOwner = user.id === thread.owner_id;
  const otherName = isOwner ? thread.helper?.display_name : thread.owner?.display_name;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
      <button onClick={() => router.push("/messages")} className="inline-flex items-center gap-2 text-[13.5px] text-inksoft hover:text-ink mb-6">
        <IconArrowLeft size={15} /> Back to messages
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:h-[640px]">
        {/* Left: project info */}
        <div className="border border-line rounded-[6px] bg-surface p-5 space-y-5 lg:overflow-y-auto">
          <div>
            <Pill className="mb-3">{project.category}</Pill>
            <h3
              className="font-display font-bold text-[16px] text-ink leading-snug cursor-pointer hover:text-accent"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              {project.title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Avatar tag={initials(otherName || "Agent")} size={26} />
            <span className="text-[13px] text-ink">{otherName || "Agent"}</span>
          </div>
          <div className="h-px bg-line"></div>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between"><span className="text-inksoft">Deadline</span><span className="font-mono text-ink">{project.deadline}</span></div>
            <div className="flex justify-between"><span className="text-inksoft">Est. work</span><span className="font-mono text-ink">{project.workload}</span></div>
            <div className="flex justify-between"><span className="text-inksoft">Listed budget</span><span className="font-mono text-ink">{money(project.budget)}</span></div>
          </div>
          {project.software?.length > 0 && (
            <>
              <div className="h-px bg-line"></div>
              <div className="flex flex-wrap gap-1.5">
                {project.software.map((s) => (
                  <span key={s} className="text-[11px] text-inksoft bg-paperdim px-2 py-0.5 rounded-[3px] border border-line">{s}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: conversation */}
        <div className="border border-line rounded-[6px] bg-surface flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
            <Avatar tag={initials(otherName || "Agent")} size={32} />
            <div>
              <div className="text-[13.5px] font-medium text-ink">{otherName || "Agent"}</div>
              {deal && (
                <div className="text-[11.5px] text-accent">
                  {deal.status === "completed" ? "Deal completed" : "Deal accepted"}
                </div>
              )}
            </div>
          </div>

                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3 min-h-[320px]">
            {messages.length === 0 && (
              <p className="text-[13px] text-inksoft text-center mt-10">No messages yet — say hello.</p>
            )}
                       {messages.map((m) => {
              const mine = m.sender_id === user.id;
              const fileUrl = m.file_path ? supabase.storage.from("project-files").getPublicUrl(m.file_path).data.publicUrl : null;
              const isImage = m.file_type?.startsWith("image/");
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  {fileUrl ? (
                    isImage ? (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="max-w-[65%] rounded-[8px] overflow-hidden border border-line">
                        <img src={fileUrl} alt={m.file_name} className="w-full max-h-64 object-cover" />
                      </a>
                    ) : (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 max-w-[75%] px-4 py-2.5 rounded-[8px] text-[13px] ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                        📄 <span className="truncate">{m.file_name}</span>
                      </a>
                    )
                  ) : (
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-[8px] text-[13.5px] leading-relaxed ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                      {m.content}
                    </div>
                  )}
                  <span className="text-[10.5px] text-inksoft mt-1 px-1">{fmtTime(m.created_at)}</span>
                </div>
              );
            })}
                       {otherTyping && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-inksoft px-1">
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-inksoft rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-inksoft rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-inksoft rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </span>
                {otherName} is typing
              </div>
            )}
            <div ref={bottomRef}></div>
          </div>

          {/* Negotiation / deal card */}
          <div className="border-t border-line px-5 py-4 bg-paperdim/60 shrink-0">
            {deal ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Agreed</div>
                    <div className="text-[18px] font-mono font-bold text-ink">{money(deal.amount)}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Platform fee</div>
                    <div className="text-[14px] font-mono text-ink">{money(deal.fee)}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Helper receives</div>
                    <div className="text-[14px] font-mono text-accent font-semibold">{money(deal.payout)}</div>
                  </div>
                </div>
                {isOwner && deal.status !== "completed" && (
                  <button onClick={markComplete} className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13.5px] px-4 py-2.5 rounded-[4px]">
                    Mark Complete
                  </button>
                )}
              </div>
            ) : isOwner ? (
              <div className="flex items-center gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Agreed amount"
                  type="number"
                  className="border border-line rounded-[4px] px-3 py-2 text-[13.5px] text-ink w-40 font-mono bg-paper"
                />
                <button onClick={acceptOffer} className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13.5px] px-4 py-2.5 rounded-[4px]">
                  Accept Offer (10% fee)
                </button>
              </div>
            ) : (
              <p className="text-[12.5px] text-inksoft">Waiting for the project owner to accept an offer.</p>
            )}
          </div>

          {/* Composer */}
                   <div className="flex items-center gap-2 px-5 py-4 border-t border-line shrink-0">
            <input
              type="file"
              id="chatFileInput"
              className="hidden"
              onChange={(e) => { if (e.target.files[0]) sendFile(e.target.files[0]); e.target.value = ""; }}
            />
            <label htmlFor="chatFileInput" className="btn-press shrink-0 w-11 h-11 rounded-[4px] border border-line flex items-center justify-center cursor-pointer text-inksoft hover:text-ink hover:border-ink">
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
              placeholder="Write a message…"
              className="flex-1 h-11 px-4 rounded-[4px] border border-line text-[13.5px] text-ink placeholder:text-inksoft/70"
            />
            <button onClick={sendMessage} className="btn-press w-11 h-11 rounded-[4px] bg-ink text-paper hover:bg-accent flex items-center justify-center shrink-0">
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}