"use client";
import { useEffect, useState } from "react";
import { money } from "./ui";
import DealPayment from "./DealPayment";

const TICK = "\u2713";
const STAR_ON = "\u2605";
const STAR_OFF = "\u2606";

const STATUS_CHIP = {
  accepted: { label: "In progress", cls: "border-accent text-accent" },
  completed: { label: "Completed", cls: "border-accent text-accent" },
  cancelled: { label: "Cancelled", cls: "border-red-500 text-red-500" },
  disputed: { label: "Under review", cls: "border-[var(--amber)] text-[var(--amber)]" },
  awaiting_payment: { label: "Awaiting payment", cls: "border-[var(--amber)] text-[var(--amber)]" },

};

function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// Deadline is DD/MM/YYYY and counts until the end of that day in Bangladesh time (UTC+6).
function deadlineEnd(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text || "");
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return Date.UTC(year, month - 1, day + 1) - 6 * 60 * 60 * 1000;
}

function fmtDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StepDot({ state }) {
  if (state === "done") return <span className="w-2.5 h-2.5 rounded-full bg-accent shrink-0"></span>;
  if (state === "current") return <span className="w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-accent/40 shrink-0"></span>;
  if (state === "cancelled") return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>;
  return <span className="w-2.5 h-2.5 rounded-full border border-line shrink-0"></span>;
}

export default function DealPanel({ deal, user, supabase, otherName, onMarkComplete, onDealChange }) {
  const [project, setProject] = useState(null);
  const [offer, setOffer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | "cancel" | "dispute"
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
   const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingChecked, setRatingChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function loadRequests() {
    const { data } = await supabase
      .from("deal_requests")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }

  async function refreshDeal() {
    const { data } = await supabase.from("deals").select("*").eq("id", deal.id).single();
    if (data) onDealChange(data);
  }

  useEffect(() => {
    let stale = false;
    supabase.from("projects").select("title, deadline").eq("id", deal.project_id).single()
      .then(({ data }) => { if (!stale) setProject(data || null); });
    supabase.from("offers").select("created_at, shortlisted_at, status")
      .eq("project_id", deal.project_id).eq("agent_id", deal.helper_id).maybeSingle()
      .then(({ data }) => { if (!stale) setOffer(data || null); });
    supabase.from("ratings").select("id").eq("deal_id", deal.id).maybeSingle()
        .then(({ data }) => { if (!stale) { setRatingSubmitted(!!data); setRatingChecked(true); } });
    return () => { stale = true; };
  }, [deal.id]);

  useEffect(() => {
    loadRequests();
    const t = setInterval(loadRequests, 6000);
    return () => clearInterval(t);
  }, [deal.id, deal.status]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const status = deal.status;
  const isOwner = user.id === deal.owner_id;
  const chip = STATUS_CHIP[status] || STATUS_CHIP.accepted;
  const end = deadlineEnd(project?.deadline);
  const overdue = status === "accepted" && end !== null && now >= end;
  const pendingCancel = requests.find((r) => r.kind === "cancel" && r.status === "pending");
 const dispute = requests.find((r) => r.kind === "dispute");
    const myDispute = requests.find((r) => r.kind === "dispute" && r.requested_by === user.id);
  const canDispute = isOwner || !!deal.delivered_at || (end !== null && now >= end);
  const finished = status === "completed";
  const cancelled = status === "cancelled";

  const paidFlow = deal.payment_status !== "legacy";
  const waitingPay = status === "awaiting_payment";
  const paymentDone = !paidFlow || ["paid", "refunded"].includes(deal.payment_status);
  const steps = [
    { key: "offer", label: "Offer sent", date: offer?.created_at, state: "done" },
    { key: "shortlisted", label: "Shortlisted", date: offer?.shortlisted_at, state: "done" },
    { key: "accepted", label: "Accepted", date: deal.created_at, state: "done" },
    ...(paidFlow
      ? [{ key: "payment", label: "Payment confirmed", date: deal.paid_at, state: paymentDone ? "done" : waitingPay ? "current" : "todo" }]
      : []),
    { key: "progress", label: "In progress", date: null, state: waitingPay ? "todo" : finished || cancelled ? (paymentDone ? "done" : "todo") : deal.delivered_at ? "done" : "current" },
    ...(deal.delivered_at || status === "accepted" || status === "disputed"
      ? [{ key: "delivered", label: "Delivered", date: deal.delivered_at, state: deal.delivered_at ? (finished || cancelled ? "done" : "current") : "todo" }]
      : []),
    finished
      ? { key: "completed", label: "Completed", date: deal.completed_at, state: "done" }
      : cancelled
        ? { key: "cancelled", label: "Cancelled", date: deal.cancelled_at, state: "cancelled" }
        : { key: "completed", label: "Completed", date: null, state: "todo" },
  ];

  async function markDelivered() {
    if (busy) return;
    if (!window.confirm("Mark this work as delivered? The client will be asked to review it.")) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("mark_deal_delivered", { p_deal_id: deal.id });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    await refreshDeal();
  }

  async function submitRequest() {
    if (busy) return;
    if (mode === "dispute" ? reason.trim().length < 20 : !reason.trim()) return;
    setBusy(true);
    setError("");
    const fn = mode === "dispute" ? "raise_deal_dispute" : "request_deal_cancel";
    const { error: rpcError } = await supabase.rpc(fn, { p_deal_id: deal.id, p_reason: reason.trim() });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setMode(null);
    setReason("");
    await loadRequests();
    await refreshDeal();
  }

  async function respond(requestId, accept) {
    if (busy) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("respond_deal_cancel", { p_request_id: requestId, p_accept: accept });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    await loadRequests();
    await refreshDeal();
  }

  async function submitRating() {
    if (!ratingStars) return;
    setSubmittingRating(true);
    const { error: ratingError } = await supabase.from("ratings").insert({
      deal_id: deal.id, rater_id: user.id, ratee_id: deal.helper_id,
      stars: ratingStars, comment: ratingComment.trim(),
    });
    if (!ratingError) {
      const { data: agentProfile } = await supabase.from("profiles").select("rating_sum, rating_count").eq("id", deal.helper_id).single();
      await supabase.from("profiles").update({
        rating_sum: (agentProfile?.rating_sum || 0) + ratingStars,
        rating_count: (agentProfile?.rating_count || 0) + 1,
      }).eq("id", deal.helper_id);
      setRatingSubmitted(true);
    }
    setSubmittingRating(false);
  }

    const compact = cancelled || (finished && (!isOwner || ratingSubmitted));

  if (finished && isOwner && !ratingChecked) return null;

  if (compact && !expanded) {
    return (
      <div className="border-t border-line px-5 py-2.5 bg-paperdim/60 shrink-0 flex items-center justify-between gap-3 text-[12.5px]">
        <span className="text-ink truncate">
          {cancelled ? "Deal cancelled" : "Deal completed"} &middot; {money(deal.amount)}
          {finished && isOwner && ratingSubmitted ? " \u00B7 " + TICK + " Rated" : ""}
        </span>
        <button type="button" onClick={() => setExpanded(true)} className="shrink-0 text-accent hover:underline">
          Show details
        </button>
      </div>
    );
  }

  const whoAsked = (r) => (r.requested_by === user.id ? "You" : otherName || "The other person");

  return (
   <div className="border-t border-line px-5 py-4 bg-paperdim/60 shrink-0 max-h-[40vh] overflow-y-auto">
      {compact && (
        <div className="flex justify-end -mt-1 mb-2">
          <button type="button" onClick={() => setExpanded(false)} className="text-[12px] text-inksoft hover:text-ink underline">
            Hide details
          </button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap">
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
        {isOwner && status === "accepted" && (
          <button onClick={onMarkComplete} className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13.5px] px-4 py-2.5 rounded-[4px]">
            Mark Complete
          </button>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-2 mt-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.label}</span>
        {overdue && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-red-500 text-red-500">Overdue</span>
        )}
        {project?.deadline && (
          <span className="text-[11.5px] text-inksoft font-mono">Due {project.deadline}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTimelineOpen((o) => !o)}
        aria-expanded={timelineOpen}
        className="mt-3 text-[12.5px] text-inksoft hover:text-ink"
      >
        Deal timeline {timelineOpen ? "\u25B4" : "\u25BE"}
      </button>

      {timelineOpen && (
        <ol className="mt-2 space-y-2" aria-label="Deal timeline">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <StepDot state={s.state} />
              <span className={`text-[12.5px] ${s.state === "todo" ? "text-inksoft/60" : s.state === "cancelled" ? "text-red-500 font-medium" : "text-ink"} ${s.state === "current" ? "font-medium" : ""}`}>
                {s.label}
              </span>
              {s.date && <span className="text-[11px] text-inksoft font-mono">{fmtDate(s.date)}</span>}
              {s.state === "current" && <span className="text-[10.5px] text-accent">Now</span>}
            </li>
          ))}
        </ol>
      )}

   {status === "accepted" && deal.delivered_at && (
        <div className="mt-4 border border-accent rounded-[4px] px-3 py-2.5 text-[12.5px] text-ink">
          {isOwner ? (
            <>
              <div className="font-medium">{otherName || "The agent"} marked the work as delivered.</div>
              <div className="text-inksoft mt-0.5">
                Check it, then press Mark Complete or raise a dispute. If you do nothing, the deal completes automatically on {fmtDateTime(deal.review_ends_at)}.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">You marked the work as delivered.</div>
              <div className="text-inksoft mt-0.5">
                The client can accept it or raise a dispute. If they do nothing, the deal completes automatically on {fmtDateTime(deal.review_ends_at)}.
              </div>
            </>
          )}
        </div>
      )}

      {!isOwner && status === "accepted" && !deal.delivered_at && (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={markDelivered}
            className="btn-press bg-ink text-paper hover:bg-accent text-[12.5px] font-medium px-3 py-2 rounded-[4px] disabled:opacity-50"
          >
            Mark as delivered
          </button>
          <p className="text-[11.5px] text-inksoft mt-1.5">
            Press this when the finished work has been sent. The client then has a few days to accept it or raise a dispute. If they don&apos;t respond, the deal completes automatically.
          </p>
        </div>
      )}

      {status === "awaiting_payment" && (
        <DealPayment deal={deal} user={user} supabase={supabase} otherName={otherName} onDealChange={onDealChange} />
      )}

      {status === "disputed" && (
        <div className="mt-4 border border-[var(--amber)] rounded-[4px] px-3 py-2.5 text-[12.5px] text-ink">
          <div className="font-medium">This deal is under review.</div>
          <div className="text-inksoft mt-0.5">Mark Complete and cancellation are locked until the review is finished.</div>
          {dispute && (
            <div className="text-inksoft mt-1.5 break-words">
              {whoAsked(dispute)} raised it: &ldquo;{dispute.reason}&rdquo;
            </div>
          )}
        </div>
      )}

      {status === "accepted" && pendingCancel && (
        <div className="mt-4 border border-line rounded-[4px] px-3 py-2.5 bg-surface">
          {pendingCancel.requested_by === user.id ? (
            <div className="text-[12.5px] text-ink">
              You asked to cancel this deal. Waiting for {otherName || "the other person"} to respond.
              <div className="text-inksoft mt-1 break-words">Your reason: &ldquo;{pendingCancel.reason}&rdquo;</div>
            </div>
          ) : (
            <div className="text-[12.5px] text-ink">
              {otherName || "The other person"} asked to cancel this deal.
              <div className="text-inksoft mt-1 break-words">&ldquo;{pendingCancel.reason}&rdquo;</div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(pendingCancel.id, true)}
                  className="btn-press bg-ink text-paper hover:bg-accent text-[12.5px] font-medium px-3 py-1.5 rounded-[4px] disabled:opacity-50"
                >
                  Accept cancellation
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(pendingCancel.id, false)}
                  className="btn-press border border-line text-ink text-[12.5px] px-3 py-1.5 rounded-[4px] disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {status === "accepted" && !pendingCancel && !mode && (
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button type="button" onClick={() => { setMode("cancel"); setError(""); }} className="text-[12.5px] text-inksoft hover:text-ink underline">
            Request cancellation
          </button>
          {myDispute ? (
<span className="text-[12px] text-inksoft">You have already raised a dispute on this deal.</span>
          ) : !canDispute ? (
            <span className="text-[12px] text-inksoft">You can raise a dispute once you mark the work as delivered, or once the deadline has passed.</span>
          ) : (
            <button type="button" onClick={() => { setMode("dispute"); setError(""); }} className="text-[12.5px] text-inksoft hover:text-red-500 underline">
              Raise a dispute
            </button>
          )}
        </div>
      )}

      {status === "accepted" && mode && (
        <div className="mt-4 border border-line rounded-[4px] p-3 bg-surface space-y-2">
          <label htmlFor="dealReason" className="text-[12.5px] text-ink font-medium block">
            {mode === "dispute" ? "Describe the problem" : "Why do you want to cancel?"}
          </label>
          <textarea
            id="dealReason"
            name="dealReason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            className="w-full px-3 py-2 rounded-[4px] border border-line text-[13px] text-ink resize-none bg-paper"
          />
          <p className="text-[11.5px] text-inksoft">
            {mode === "dispute"
           ? `Raising a dispute freezes the deal until it has been reviewed. Write at least 20 characters (${reason.trim().length}/20).`
              : `${otherName || "The other person"} must accept before the deal is cancelled.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
       disabled={busy || (mode === "dispute" ? reason.trim().length < 20 : !reason.trim())}
              onClick={submitRequest}
              className="btn-press bg-ink text-paper hover:bg-accent text-[12.5px] font-medium px-3 py-1.5 rounded-[4px] disabled:opacity-40"
            >
              {busy ? "Sending\u2026" : mode === "dispute" ? "Raise dispute" : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setReason(""); setError(""); }}
              className="btn-press border border-line text-ink text-[12.5px] px-3 py-1.5 rounded-[4px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12.5px] text-red-500 mt-3">{error}</p>}

      {isOwner && finished && !ratingSubmitted && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[13px] text-ink font-medium mb-2">Rate this agent</p>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRatingStars(n)} aria-label={n + " star" + (n > 1 ? "s" : "")} className="text-[22px] leading-none">
                {n <= ratingStars ? STAR_ON : STAR_OFF}
              </button>
            ))}
          </div>
          <input
            id="ratingComment"
            name="ratingComment"
            aria-label="Optional comment"
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder={"Optional comment\u2026"}
            className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink mb-2 bg-paper"
          />
          <button
            type="button"
            onClick={submitRating}
            disabled={!ratingStars || submittingRating}
            className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[13px] px-4 py-2 rounded-[4px] disabled:opacity-40"
          >
            {submittingRating ? "Submitting\u2026" : "Submit rating"}
          </button>
        </div>
      )}

      {isOwner && finished && ratingSubmitted && (
        <p className="text-[12.5px] text-accent mt-4 pt-4 border-t border-line">{TICK} You rated this agent</p>
      )}
    </div>
  );
}