"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { money } from "../../../components/ui";

const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : "");
const cleanTrx = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export default function AdminWithdrawalsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [allowed, setAllowed] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("requested");
  const [action, setAction] = useState(null); // { id, kind: "paid" | "rejected" }
  const [trx, setTrx] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function load() {
    const { data, error: listError } = await supabase.rpc("admin_list_withdrawals");
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

  const canConfirm = action && (action.kind === "paid" ? trx.length >= 8 : note.trim().length > 0);

  async function confirmAction() {
    if (!action || busy || !canConfirm) return;
    setBusy(true);
    setError("");
    const { error: reviewError } = await supabase.rpc("admin_review_withdrawal", {
      p_id: action.id,
      p_action: action.kind,
      p_trx: action.kind === "paid" ? trx : "",
      p_note: note.trim(),
    });
    setBusy(false);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    setAction(null);
    setTrx("");
    setNote("");
    await load();
  }

  if (allowed === undefined) {
    return <div className="max-w-4xl mx-auto px-5 py-16 text-inksoft">Checking access&hellip;</div>;
  }
  if (!allowed) {
    return <div className="max-w-4xl mx-auto px-5 py-16 text-inksoft">You don&apos;t have access to this page.</div>;
  }

  const open = rows.filter((r) => r.withdrawal_status === "requested");
  const done = rows.filter((r) => r.withdrawal_status !== "requested");
  const shown = tab === "requested" ? open : done;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-8">
      <h1 className="font-display font-extrabold text-[24px] text-ink mb-1">Withdrawals</h1>
      <p className="text-[13.5px] text-inksoft mb-4">Send each amount from your bKash app, then record the TrxID here.</p>

      <div className="border border-[var(--amber)] rounded-[4px] px-4 py-3 mb-6 text-[12.5px] text-ink">
        <strong>Order of work:</strong> 1) send the money to the number shown, 2) copy your bKash TrxID for that
        transfer, 3) press <strong>Mark as paid</strong> and enter it. If you can&apos;t pay, press Reject and give a
        reason. The money returns to the person&apos;s wallet.
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("requested")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "requested" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          To pay ({open.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("done")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "done" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          Handled ({done.length})
        </button>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-[14px] text-inksoft">Loading&hellip;</p>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-line rounded-[6px] py-14 text-center text-[14px] text-inksoft">
          {tab === "requested" ? "No withdrawals waiting." : "Nothing handled yet."}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((r) => {
            const picking = action && action.id === r.withdrawal_id;
            return (
              <div key={r.withdrawal_id} className="border border-line rounded-[6px] bg-surface p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-[15px] text-ink">{r.user_name || "Unknown"}</h2>
                    <p className="text-[11.5px] text-inksoft font-mono mt-0.5">Requested {fmt(r.requested_at)}</p>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      r.withdrawal_status === "requested"
                        ? "border-[var(--amber)] text-[var(--amber)]"
                        : r.withdrawal_status === "paid"
                          ? "border-accent text-accent"
                          : "border-red-500 text-red-500"
                    }`}
                  >
                    {r.withdrawal_status === "requested" ? "To pay" : r.withdrawal_status === "paid" ? "Paid" : "Rejected"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Amount to send</div>
                    <div className="text-[20px] font-mono font-bold text-ink">{money(Number(r.amount))}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Send to bKash</div>
                    <div className="text-[16px] font-mono text-ink">
                      {r.bkash_number}
                      <button type="button" onClick={() => copy(r.withdrawal_id, r.bkash_number)} className="ml-2 text-[11px] text-accent underline">
                        {copiedId === r.withdrawal_id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                {r.withdrawal_status !== "requested" && (
                  <div className="mt-3 text-[12.5px] text-inksoft">
                    Handled {fmt(r.reviewed_at)}
                    {r.payout_trx_id ? <span className="block mt-1 font-mono text-ink">Payout TrxID: {r.payout_trx_id}</span> : null}
                    {r.admin_note ? <span className="block mt-1 text-ink break-words">Note: {r.admin_note}</span> : null}
                  </div>
                )}

                {r.withdrawal_status === "requested" && !picking && (
                  <div className="flex items-center gap-2 mt-5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setAction({ id: r.withdrawal_id, kind: "paid" }); setTrx(""); setNote(""); setError(""); }}
                      className="btn-press bg-ink text-paper hover:bg-accent text-[13px] font-medium px-4 py-2 rounded-[4px]"
                    >
                      Mark as paid
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAction({ id: r.withdrawal_id, kind: "rejected" }); setTrx(""); setNote(""); setError(""); }}
                      className="btn-press bg-red-600 text-white hover:bg-red-700 text-[13px] font-medium px-4 py-2 rounded-[4px]"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {picking && (
                  <div className="mt-5 border border-line rounded-[4px] p-4 bg-paperdim/50 space-y-3">
                    <div className="text-[13.5px] text-ink font-medium">
                      {action.kind === "paid" ? "Record this payout" : "Reject this withdrawal?"}
                    </div>
                    {action.kind === "paid" ? (
                      <>
                        <p className="text-[12.5px] text-inksoft">
                          Only do this after you sent {money(Number(r.amount))} to {r.bkash_number} in bKash.
                        </p>
                        <div>
                          <label htmlFor={"trx-" + r.withdrawal_id} className="text-[12px] text-inksoft block mb-1">Your bKash TrxID for this payout</label>
                          <input
                            id={"trx-" + r.withdrawal_id}
                            name="payoutTrx"
                            autoComplete="off"
                            value={trx}
                            onChange={(e) => setTrx(cleanTrx(e.target.value))}
                            className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper"
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-[12.5px] text-inksoft">The money goes back to the person&apos;s wallet and they are told why.</p>
                    )}
                    <div>
                      <label htmlFor={"wnote-" + r.withdrawal_id} className="text-[12px] text-inksoft block mb-1">
                        {action.kind === "paid" ? "Note (optional)" : "Reason (required, shown to the person)"}
                      </label>
                      <textarea
                        id={"wnote-" + r.withdrawal_id}
                        name="withdrawalNote"
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 500))}
                        rows={2}
                        className="w-full px-3 py-2 rounded-[4px] border border-line text-[13px] text-ink resize-none bg-paper"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !canConfirm}
                        onClick={confirmAction}
                        className={`btn-press text-[13px] font-medium px-4 py-2 rounded-[4px] disabled:opacity-40 ${action.kind === "paid" ? "bg-ink text-paper hover:bg-accent" : "bg-red-600 text-white hover:bg-red-700"}`}
                      >
                        {busy ? "Saving\u2026" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setAction(null); setTrx(""); setNote(""); }}
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