"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { Avatar, initials, money } from "./ui";

export default function ProjectChat({ project }) {
  const supabase = createClient();
  const [user, setUser] = useState(undefined);
  const [isOwner, setIsOwner] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [deal, setDeal] = useState(null);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setIsOwner(u && u.id === project.owner_id);
    });
  }, []);

  useEffect(() => {
    if (user === undefined || !user) return;
    if (isOwner) {
      supabase
        .from("threads")
        .select("*, profiles!threads_helper_id_fkey(display_name, agent_code)")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setThreads(data || []));
    } else {
      supabase
        .from("threads")
        .select("*")
        .eq("project_id", project.id)
        .eq("helper_id", user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setActiveThread(data); });
    }
  }, [user, isOwner]);

  useEffect(() => {
    if (!activeThread) return;
    const loadMessages = () => {
      supabase
        .from("messages")
        .select("*")
        .eq("thread_id", activeThread.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
    };
    const loadDeal = () => {
      supabase
        .from("deals")
        .select("*")
        .eq("thread_id", activeThread.id)
        .maybeSingle()
        .then(({ data }) => setDeal(data || null));
    };
        loadMessages();
    loadDeal();
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", activeThread.id)
      .neq("sender_id", user.id)
      .is("read_at", null)
      .then(() => {});
    const interval = setInterval(() => { loadMessages(); loadDeal(); }, 4000);
    return () => clearInterval(interval);
  }, [activeThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startThread() {
    const { data, error } = await supabase
      .from("threads")
      .insert({ project_id: project.id, owner_id: project.owner_id, helper_id: user.id })
      .select()
      .single();
    if (!error) setActiveThread(data);
  }

  async function sendMessage() {
    if (!text.trim() || !activeThread || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ thread_id: activeThread.id, sender_id: user.id, content });
    if (!error) {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", activeThread.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    }
    setSending(false);
  }

  async function acceptOffer() {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    const { data, error } = await supabase
      .from("deals")
      .insert({
        thread_id: activeThread.id,
        project_id: project.id,
        owner_id: project.owner_id,
        helper_id: activeThread.helper_id,
        amount: amt,
      })
      .select()
      .single();
    if (!error) {
      await supabase.from("threads").update({ status: "deal_accepted" }).eq("id", activeThread.id);
      await supabase.from("projects").update({ status: "in_progress" }).eq("id", project.id);
      setActiveThread({ ...activeThread, status: "deal_accepted" });
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

  if (user === undefined) {
    return <div className="border border-line rounded-[6px] bg-surface p-5 text-[13.5px] text-inksoft">Loading…</div>;
  }
  if (!user) {
    return <div className="border border-line rounded-[6px] bg-surface p-5 text-[13.5px] text-inksoft">Log in to message about this project.</div>;
  }

  // OWNER: thread picker
  if (isOwner && !activeThread) {
    return (
      <div className="border border-line rounded-[6px] bg-surface p-5">
        <h2 className="font-display font-bold text-[15px] text-ink mb-3">Messages</h2>
        {threads.length === 0 && <p className="text-[13.5px] text-inksoft">No one has reached out yet.</p>}
        <div className="space-y-2">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveThread(t)}
              className="w-full flex items-center gap-2.5 text-left text-[13.5px] text-ink border border-line rounded-[4px] px-3 py-2.5 hover:bg-paperdim transition-colors"
            >
              <Avatar tag={initials(t.profiles?.display_name || "Agent")} size={26} />
              <span className="font-medium">{t.profiles?.display_name || "Agent"}</span>
              {t.status === "deal_accepted" && (
                <span className="ml-auto text-[11px] text-accent font-medium">Deal accepted</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // HELPER: no thread yet
  if (!isOwner && !activeThread) {
    return (
      <div className="border border-line rounded-[6px] bg-surface p-5">
        <button
          onClick={startThread}
          className="bg-accent text-white text-[13.5px] font-medium px-5 py-2.5 rounded-[4px] hover:opacity-90 transition-opacity"
        >
          Offer to Help
        </button>
      </div>
    );
  }

  const otherName = isOwner
    ? (threads.find((t) => t.id === activeThread.id)?.profiles?.display_name || "Agent")
    : project.profiles?.display_name || "Project Owner";

  return (
    <div className="border border-line rounded-[6px] bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line bg-paperdim">
        {isOwner && (
          <button onClick={() => setActiveThread(null)} className="text-inksoft hover:text-ink text-[16px] mr-1">
            ←
          </button>
        )}
        <Avatar tag={initials(otherName)} size={26} />
        <div className="text-[13.5px] font-medium text-ink">{otherName}</div>
        {deal && (
          <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${
            deal.status === "completed" ? "bg-accent/10 text-accent" : "bg-ink/5 text-inksoft"
          }`}>
            {deal.status === "completed" ? "Completed" : "Deal accepted"}
          </span>
        )}
      </div>

      {/* Deal summary card */}
      {deal && (
        <div className="px-5 py-3.5 border-b border-line bg-accent/5 flex items-center gap-6 text-[13px]">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Agreed</div>
            <div className="font-mono font-bold text-ink">{money(deal.amount)}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Platform fee</div>
            <div className="font-mono text-inksoft">{money(deal.fee)}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Helper payout</div>
            <div className="font-mono text-ink">{money(deal.payout)}</div>
          </div>
          {isOwner && deal.status !== "completed" && (
            <button
              onClick={markComplete}
              className="ml-auto bg-ink text-white text-[12.5px] font-medium px-4 py-2 rounded-[4px] hover:opacity-90"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="px-5 py-4 h-80 overflow-y-auto space-y-3 bg-paper">
        {messages.length === 0 && (
          <p className="text-[13px] text-inksoft text-center mt-10">No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`text-[13.5px] px-3.5 py-2 rounded-[10px] max-w-[75%] leading-relaxed ${
                  mine ? "bg-accent text-white rounded-br-[3px]" : "bg-paperdim text-ink rounded-bl-[3px]"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10.5px] text-inksoft mt-1 px-1">{fmtTime(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message…"
          className="flex-1 border border-line rounded-full px-4 py-2 text-[13.5px] text-ink bg-paper focus:outline-none focus:border-accent"
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="bg-accent text-white text-[13px] font-medium px-4 py-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </div>

      {/* Accept offer (owner, before a deal exists) */}
      {isOwner && !deal && (
        <div className="border-t border-line px-4 py-3 flex items-center gap-2 bg-paperdim">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Agreed amount"
            type="number"
            className="border border-line rounded-[4px] px-3 py-2 text-[13.5px] text-ink w-36 font-mono bg-paper"
          />
          <button
            onClick={acceptOffer}
            className="bg-ink text-white text-[13px] font-medium px-4 py-2 rounded-[4px] hover:opacity-90"
          >
            Accept Offer (10% fee)
          </button>
        </div>
      )}
    </div>
  );
}