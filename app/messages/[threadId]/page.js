"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { Avatar, money, initials, IconArrowLeft, IconStar, SecondaryButton } from "../../../components/ui";

export default function ChatDetailPage() {
  const { threadId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(undefined);
  const [thread, setThread] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [deal, setDeal] = useState(null);
  const [dealProjectTitle, setDealProjectTitle] = useState("");
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [projectCards, setProjectCards] = useState({});
  const [threadList, setThreadList] = useState([]);
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
        owner:profiles!threads_owner_id_fkey(display_name, avatar_url, specialty, skills, rating_sum, rating_count, completed_count),
        helper:profiles!threads_helper_id_fkey(display_name, avatar_url, specialty, skills, rating_sum, rating_count, completed_count)
      `)
      .eq("id", threadId)
      .single()
      .then(({ data }) => setThread(data || null));
  }, [threadId]);

  // left-sidebar conversation list (desktop only)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("threads")
      .select(`*, projects(title), owner:profiles!threads_owner_id_fkey(display_name, avatar_url), helper:profiles!threads_helper_id_fkey(display_name, avatar_url)`)
      .or(`owner_id.eq.${user.id},helper_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => setThreadList(data || []));
  }, [user, threadId]);

  useEffect(() => {
    if (!thread || !user) return;

    const loadMessages = () => {
      supabase.from("messages").select("*").eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
    };
    const loadDeal = () => {
      supabase.from("deals").select("*").eq("thread_id", thread.id).maybeSingle()
        .then(({ data }) => {
          setDeal(data || null);
          if (data) {
            supabase.from("ratings").select("id").eq("deal_id", data.id).maybeSingle()
              .then(({ data: existingRating }) => setRatingSubmitted(!!existingRating));
            supabase.from("projects").select("title").eq("id", data.project_id).single()
              .then(({ data: proj }) => setDealProjectTitle(proj?.title || ""));
          }
        });
    };

    loadMessages();
    loadDeal();
    supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id).neq("sender_id", user.id).is("read_at", null)
      .then(() => {});

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
    const dealInterval = setInterval(loadDeal, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dealInterval);
    };
  }, [thread, user]);

  useEffect(() => {
    if (!thread) return;
    const missingIds = [...new Set(messages.filter((m) => m.project_id).map((m) => m.project_id))]
      .filter((id) => !projectCards[id]);
    if (missingIds.length === 0) return;

    (async () => {
      for (const pid of missingIds) {
        const { data: proj } = await supabase.from("projects").select("id, title, category, budget, deadline, owner_id").eq("id", pid).single();
        if (!proj) continue;
        const { data: file } = await supabase.from("project_files").select("file_path").eq("project_id", pid).limit(1).maybeSingle();
        const imageUrl = file ? supabase.storage.from("project-files").getPublicUrl(file.file_path).data.publicUrl : null;
        const agentId = proj.owner_id === thread.owner_id ? thread.helper_id : thread.owner_id;
        const { data: offer } = await supabase.from("offers").select("*").eq("project_id", pid).eq("agent_id", agentId).maybeSingle();
        setProjectCards((cur) => ({ ...cur, [pid]: { ...proj, imageUrl, offer: offer || null } }));
      }
    })();
  }, [messages, thread]);

  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
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
        thread_id: thread.id, sender_id: user.id,
        file_path: path, file_name: file.name, file_type: file.type,
      });
    }
  }

  async function acceptOfferForCard(card) {
    if (!card.offer || deal) return;
    const agentId = card.owner_id === thread.owner_id ? thread.helper_id : thread.owner_id;
    const { data, error } = await supabase.from("deals").insert({
      thread_id: thread.id, project_id: card.id,
      owner_id: card.owner_id, helper_id: agentId, amount: card.offer.amount,
    }).select().single();
    if (!error) {
      await supabase.from("threads").update({ status: "deal_accepted" }).eq("id", thread.id);
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

  async function submitRating() {
    if (!deal || !ratingStars) return;
    setSubmittingRating(true);
    const { error } = await supabase.from("ratings").insert({
      deal_id: deal.id, rater_id: user.id, ratee_id: deal.helper_id,
      stars: ratingStars, comment: ratingComment.trim(),
    });
    if (!error) {
      const { data: agentProfile } = await supabase.from("profiles").select("rating_sum, rating_count").eq("id", deal.helper_id).single();
      await supabase.from("profiles").update({
        rating_sum: (agentProfile?.rating_sum || 0) + ratingStars,
        rating_count: (agentProfile?.rating_count || 0) + 1,
      }).eq("id", deal.helper_id);
      setRatingSubmitted(true);
    }
    setSubmittingRating(false);
  }

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (user === undefined || thread === undefined) {
    return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  }
  if (!thread || !user || (user.id !== thread.owner_id && user.id !== thread.helper_id)) {
    return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Conversation not found.</div>;
  }

  const isOwner = user.id === thread.owner_id;
  const otherId = isOwner ? thread.helper_id : thread.owner_id;
  const otherProfile = isOwner ? thread.helper : thread.owner;
  const otherName = otherProfile?.display_name;
  const otherAvatar = otherProfile?.avatar_url;
  const dealIsOwner = deal && user.id === deal.owner_id;
  const otherRating = otherProfile?.rating_count ? (otherProfile.rating_sum / otherProfile.rating_count).toFixed(1) : null;
  const otherHasAgentProfile = otherProfile?.specialty || (otherProfile?.skills || []).length > 0 || otherProfile?.rating_count > 0;

  return (
    <div className="w-full px-5 md:px-8 py-8">
      <button onClick={() => router.push("/messages")} className="lg:hidden inline-flex items-center gap-2 text-[13.5px] text-inksoft hover:text-ink mb-6">
        <IconArrowLeft size={15} /> Back to messages
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-5 h-[calc(100vh-180px)]">

        {/* Left: conversation list, desktop only */}
        <div className="hidden lg:flex flex-col border border-line rounded-[6px] bg-surface overflow-hidden">
          <div className="px-4 py-3.5 border-b border-line font-display font-bold text-[14px] text-ink">Messages</div>
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {threadList.map((t) => {
              const tIsOwner = t.owner_id === user.id;
              const tName = tIsOwner ? t.helper?.display_name : t.owner?.display_name;
              const tAvatar = tIsOwner ? t.helper?.avatar_url : t.owner?.avatar_url;
              const active = t.id === threadId;
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/messages/${t.id}`)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 text-left ${active ? "bg-accent/10" : "hover:bg-paperdim/60"}`}
                >
                  <Avatar tag={initials(tName || "Agent")} size={30} src={tAvatar} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-ink truncate">{tName || "Agent"}</div>
                    <div className="text-[11px] text-inksoft truncate">{t.projects?.title || "Direct message"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: conversation */}
        <div className="border border-line rounded-[6px] bg-surface flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
            <Avatar tag={initials(otherName || "Agent")} size={32} src={otherAvatar} />
            <div>
              <div className="text-[13.5px] font-medium text-ink">{otherName || "Agent"}</div>
              {deal && (
                <div className="text-[11.5px] text-accent">
                  {deal.status === "completed" ? "Deal completed" : "Deal accepted"} · {dealProjectTitle}
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
                  {m.project_id ? (
                    <ProjectCardMessage
                      card={projectCards[m.project_id]}
                      currentUserId={user.id}
                      deal={deal}
                      onClick={() => router.push(`/projects/${m.project_id}`)}
                      onAccept={acceptOfferForCard}
                    />
                  ) : fileUrl ? (
                    isImage ? (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="max-w-[55%] rounded-[8px] overflow-hidden border border-line">
                        <img src={fileUrl} alt={m.file_name} className="w-full max-h-64 object-cover" />
                      </a>
                    ) : (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 max-w-[55%] px-4 py-2.5 rounded-[8px] text-[13px] ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                        📄 <span className="truncate">{m.file_name}</span>
                      </a>
                    )
                  ) : (
                    <div className={`max-w-[55%] px-4 py-2.5 rounded-[8px] text-[13.5px] leading-relaxed ${mine ? "bg-ink text-paper rounded-br-[2px]" : "bg-paperdim text-ink rounded-bl-[2px]"}`}>
                      {m.content}
                    </div>
                  )}
                  {!m.project_id && (
                    <span className="text-[10.5px] text-inksoft mt-1 px-1">{fmtTime(m.created_at)}</span>
                  )}
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

          {deal && (
            <div className="border-t border-line px-5 py-4 bg-paperdim/60 shrink-0">
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
                {dealIsOwner && deal.status !== "completed" && (
                  <button onClick={markComplete} className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13.5px] px-4 py-2.5 rounded-[4px]">
                    Mark Complete
                  </button>
                )}
              </div>

              {dealIsOwner && deal.status === "completed" && !ratingSubmitted && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-[13px] text-ink font-medium mb-2">Rate this agent</p>
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRatingStars(n)} className="text-[22px] leading-none">
                        {n <= ratingStars ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                  <input
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Optional comment…"
                    className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink mb-2 bg-paper"
                  />
                  <button
                    onClick={submitRating}
                    disabled={!ratingStars || submittingRating}
                    className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13px] px-4 py-2 rounded-[4px] disabled:opacity-40"
                  >
                    {submittingRating ? "Submitting…" : "Submit rating"}
                  </button>
                </div>
              )}

              {dealIsOwner && deal.status === "completed" && ratingSubmitted && (
                <p className="text-[12.5px] text-accent mt-4 pt-4 border-t border-line">✓ You rated this agent</p>
              )}
            </div>
          )}

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

        {/* Right: the other person's info, desktop only */}
        <div className="hidden lg:block border border-line rounded-[6px] bg-surface p-5 overflow-y-auto">
          <div className="flex flex-col items-center text-center">
            <Avatar tag={initials(otherName || "Agent")} size={64} src={otherAvatar} />
            <h3 className="font-display font-bold text-[16px] text-ink mt-3">{otherName || "Agent"}</h3>
            {otherProfile?.specialty && <p className="text-[12.5px] text-accent mt-1">{otherProfile.specialty}</p>}
          </div>

          {otherHasAgentProfile ? (
            <>
              <div className="flex items-center justify-center gap-6 mt-5 pt-5 border-t border-line">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[15px] font-display font-bold text-ink">
                    <IconStar size={13} className="text-accent" /> {otherRating || "New"}
                  </div>
                  <div className="text-[10.5px] text-inksoft mt-0.5">Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-display font-bold text-ink">{otherProfile?.completed_count || 0}</div>
                  <div className="text-[10.5px] text-inksoft mt-0.5">Completed</div>
                </div>
              </div>

              {(otherProfile?.skills || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-5">
                  {otherProfile.skills.map((s) => (
                    <span key={s} className="text-[11px] text-inksoft bg-paperdim px-2 py-0.5 rounded-[3px] border border-line">{s}</span>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <SecondaryButton className="w-full" onClick={() => router.push(`/agents/${otherId}`)}>
                  View Full Profile
                </SecondaryButton>
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-inksoft text-center mt-5 pt-5 border-t border-line">
              No public agent profile yet.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

function ProjectCardMessage({ card, currentUserId, deal, onClick, onAccept }) {
  if (!card) {
    return <div className="w-72 h-24 rounded-[8px] border border-line bg-paperdim animate-pulse"></div>;
  }
  const isOwnerHere = currentUserId === card.owner_id;
  const dealIsForThisCard = deal && deal.project_id === card.id;
  const canAccept = isOwnerHere && card.offer && ["pending", "shortlisted"].includes(card.offer.status) && !deal;

  return (
    <div className="w-72 rounded-[8px] border border-line bg-surface overflow-hidden">
      <button onClick={onClick} className="tick card-lift text-left w-full block">
        <div className="px-3 pt-2.5 pb-1.5 text-[10.5px] font-mono text-inksoft uppercase tracking-wide">
          📁 Re: this project
        </div>
        {card.imageUrl && (
          <img src={card.imageUrl} alt={card.title} className="w-full h-28 object-cover" />
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-inksoft bg-paperdim px-2 py-0.5 rounded-[3px] border border-line">{card.category}</span>
            <span className="text-[12.5px] font-mono text-accent font-semibold">{money(card.budget)}</span>
          </div>
          <h4 className="font-display font-semibold text-[13.5px] text-ink leading-snug">{card.title}</h4>
          <div className="text-[11px] text-inksoft">Due {card.deadline}</div>
        </div>
      </button>

      {dealIsForThisCard && (
        <div className="px-3 py-2 border-t border-line text-[11.5px] text-accent font-medium">
          {deal.status === "completed" ? "✓ Deal completed" : "✓ Deal accepted"}
        </div>
      )}

      {canAccept && (
        <button
          onClick={() => onAccept(card)}
          className="btn-press w-full bg-ink text-paper hover:bg-accent font-medium text-[12.5px] px-3 py-2.5 border-t border-line"
        >
          Accept Offer — {money(card.offer.amount)} (10% fee)
        </button>
      )}
    </div>
  );
}