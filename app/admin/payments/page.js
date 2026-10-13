"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { money } from "../../../components/ui";

const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : "");

export default function AdminPaymentsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [allowed, setAllowed] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [action, setAction] = useState(null); // { id, approve }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function load() {
    const { data, error: listError } = await supabase.rpc("admin_list_payments");
    if (listError) {
      setError(listError.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        router.push("/login");
        return;
      }
      const { data: ok } = await supabase.rpc("is_admin");
      setAllowed(ok === true);
      if (ok === true) load();
    });
  }, []);

  async function copy(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1500);
    } catch (e) {
      // clipboard may be blocked; the text is still on screen
    }
  }

  async function confirmAction() {
    if (!action || busy) return;
    if (!action.approve && !note.trim()) return;
    setBusy(true);
    setError("");
    const { error: reviewError } = await supabase.rpc("admin_review_payment", {
      p_payment_id: action.id,
      p_approve: action.approve,
      p_note: note.trim(),
    });
    setBusy(false);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    setAction(null);
    setNote("");
    await load();
  }

  if (allowed === undefined) {
    return <div className="max-w-4xl mx-auto px-5 py-16 text-inksoft">Checking access&hellip;</div>;
  }
  if (!allowed) {
    return <div className="max-w-4xl mx-auto px-5 py-16 text-inksoft">You don&apos;t have access to this page.</div>;
  }

  const pending = rows.filter((r) => r.payment_status === "pending");
  const reviewed = rows.filter((r) => r.payment_status !== "pending");
  const shown = tab === "pending" ? pending : reviewed;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-8">
      <h1 className="font-display font-extrabold text-[24px] text-ink mb-1">Payments</h1>
      <p className="text-[13.5px] text-inksoft mb-4">bKash payments and wallet top-ups waiting for you to confirm.</p>

      <div className="border border-[var(--amber)] rounded-[4px] px-4 py-3 mb-6 text-[12.5px] text-ink">
        <strong>Before you approve:</strong> open your bKash app and check all three things. The TrxID exists in your
        received payments, the amount matches exactly, and the sender number matches. Approving credits real money
        in the system.
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "pending" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          To review ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("done")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "done" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          Reviewed ({reviewed.length})
        </button>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-[14px] text-inksoft">Loading&hellip;</p>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-line rounded-[6px] py-14 text-center text-[14px] text-inksoft">
          {tab === "pending" ? "No payments waiting for review." : "Nothing reviewed yet."}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((r) => {
            const picking = action && action.id === r.payment_id;
            const dealGone = r.purpose === "deal" && r.deal_status && r.deal_status !== "awaiting_payment";
            return (
              <div key={r.payment_id} className="border border-line rounded-[6px] bg-surface p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-[15px] text-ink">
                      {r.purpose === "topup" ? "Wallet top-up" : "Deal payment"}
                    </h2>
                    {r.purpose === "deal" && r.project_title && (
                      <p className="text-[12.5px] text-inksoft break-words">For &ldquo;{r.project_title}&rdquo;</p>
                    )}
                    <p className="text-[11.5px] text-inksoft font-mono mt-0.5">Submitted {fmt(r.submitted_at)}</p>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      r.payment_status === "pending"
                        ? "border-[var(--amber)] text-[var(--amber)]"
                        : r.payment_status === "approved"
                          ? "border-accent text-accent"
                          : "border-red-500 text-red-500"
                    }`}
                  >
                    {r.payment_status === "pending" ? "To review" : r.payment_status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Amount to find</div>
                    <div className="text-[18px] font-mono font-bold text-ink">{money(Number(r.amount))}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">From</div>
                    <div className="text-[13.5px] text-ink">{r.user_name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Sender bKash</div>
                    <div className="text-[13.5px] font-mono text-ink">{r.sender_number}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">TrxID</div>
                    <div className="text-[13.5px] font-mono text-ink break-all">
                      {r.trx_id}
                      <button type="button" onClick={() => copy(r.payment_id, r.trx_id)} className="ml-2 text-[11px] text-accent underline">
                        {copiedId === r.payment_id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                {dealGone && r.payment_status === "pending" && (
                  <p className="mt-3 text-[12.5px] text-[var(--amber)]">
                    This deal is no longer waiting for payment. If you approve, the money goes into the client&apos;s wallet instead.
                  </p>
                )}

                {r.payment_status !== "pending" && (
                  <div className="mt-3 text-[12.5px] text-inksoft">
                    Reviewed {fmt(r.reviewed_at)}
                    {r.admin_note ? <span className="block mt-1 text-ink break-words">Note: {r.admin_note}</span> : null}
                  </div>
                )}

                {r.payment_status === "pending" && !picking && (
                  <div className="flex items-center gap-2 mt-5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setAction({ id: r.payment_id, approve: true }); setNote(""); setError(""); }}
                      className="btn-press bg-ink text-paper hover:bg-accent text-[13px] font-medium px-4 py-2 rounded-[4px]"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAction({ id: r.payment_id, approve: false }); setNote(""); setError(""); }}
                      className="btn-press bg-red-600 text-white hover:bg-red-700 text-[13px] font-medium px-4 py-2 rounded-[4px]"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {picking && (
                  <div className="mt-5 border border-line rounded-[4px] p-4 bg-paperdim/50 space-y-3">
                    <div className="text-[13.5px] text-ink font-medium">
                      {action.approve ? "Approve this payment?" : "Reject this payment?"}
                    </div>
                    <p className="text-[12.5px] text-inksoft">
                      {action.approve
                        ? `You confirm that ${money(Number(r.amount))} from ${r.sender_number} with TrxID ${r.trx_id} is in your bKash account.`
                        : "The person is told it could not be confirmed and can submit a new TrxID."}
                    </p>
                    <div>
                      <label htmlFor={"note-" + r.payment_id} className="text-[12px] text-inksoft block mb-1">
                        {action.approve ? "Note (optional)" : "Reason (required, shown to the person)"}
                      </label>
                      <textarea
                        id={"note-" + r.payment_id}
                        name="paymentNote"
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 500))}
                        rows={2}
                        className="w-full px-3 py-2 rounded-[4px] border border-line text-[13px] text-ink resize-none bg-paper"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || (!action.approve && !note.trim())}
                        onClick={confirmAction}
                        className={`btn-press text-[13px] font-medium px-4 py-2 rounded-[4px] disabled:opacity-40 ${action.approve ? "bg-ink text-paper hover:bg-accent" : "bg-red-600 text-white hover:bg-red-700"}`}
                      >
                        {busy ? "Saving\u2026" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setAction(null); setNote(""); }}
                        className="btn-press border border-line text-ink text-[13px] px-4 py-2 rounded-[4px]"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}