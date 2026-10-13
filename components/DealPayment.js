"use client";
import { useEffect, useState } from "react";
import { money } from "./ui";

const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);
const cleanTrx = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export default function DealPayment({ deal, user, supabase, otherName, onDealChange }) {
  const isOwner = user.id === deal.owner_id;
  const [bkashNumber, setBkashNumber] = useState("");
  const [balance, setBalance] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);
  const [showBkash, setShowBkash] = useState(false);
  const [trx, setTrx] = useState("");
  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stale = false;
    supabase.from("platform_settings").select("value").eq("key", "bkash_number").maybeSingle()
      .then(({ data }) => { if (!stale) setBkashNumber(data?.value || ""); });
    if (isOwner) {
      supabase.rpc("wallet_summary").then(({ data }) => {
        if (!stale) setBalance(Array.isArray(data) && data[0] ? Number(data[0].available) : 0);
      });
      supabase.from("payments").select("*").eq("deal_id", deal.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => { if (!stale) setLastPayment(data || null); });
    }
    return () => { stale = true; };
  }, [deal.id, deal.payment_status]);

  async function refreshDeal() {
    const { data } = await supabase.from("deals").select("*").eq("id", deal.id).single();
    if (data) onDealChange(data);
  }

  async function payWithWallet() {
    if (busy) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("pay_deal_with_wallet", { p_deal_id: deal.id });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    await refreshDeal();
  }

  async function submitBkash() {
    if (busy) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("submit_deal_payment", {
      p_deal_id: deal.id,
      p_trx_id: trx,
      p_sender: sender,
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setShowBkash(false);
    setTrx("");
    setSender("");
    await refreshDeal();
  }

  async function cancelBeforePayment() {
    if (busy) return;
    if (!window.confirm("Cancel this deal? Nothing has been paid yet.")) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("cancel_unpaid_deal", { p_deal_id: deal.id });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    await refreshDeal();
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(bkashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // clipboard may be blocked; the number is still shown on screen
    }
  }

  const waitingReview = deal.payment_status === "pending";
  const enough = balance !== null && balance >= deal.amount;
  const canSubmit = trx.length >= 8 && sender.length >= 11 && !busy;

  return (
    <div className="mt-4 border border-[var(--amber)] rounded-[4px] px-3 py-3 bg-surface space-y-3">
      <div className="text-[13px] text-ink font-medium">
        {waitingReview ? "Payment under review" : "Payment needed before work starts"}
      </div>

      {!isOwner && (
        <p className="text-[12.5px] text-inksoft">
          {waitingReview
            ? `${otherName || "The client"} has sent a payment and it is being confirmed. You'll be notified when you can start.`
            : `Waiting for ${otherName || "the client"} to pay ${money(deal.amount)}. Please don't start the work until the payment is confirmed.`}
        </p>
      )}

      {isOwner && waitingReview && (
        <p className="text-[12.5px] text-inksoft">
          We're checking your bKash payment{lastPayment?.trx_id ? ` (TrxID ${lastPayment.trx_id})` : ""}. You'll be notified as soon as it's confirmed.
        </p>
      )}

      {isOwner && !waitingReview && (
        <>
          {lastPayment?.status === "rejected" && (
            <p className="text-[12.5px] text-red-500 break-words">
              Your last payment (TrxID {lastPayment.trx_id}) could not be confirmed
              {lastPayment.admin_note ? `: ${lastPayment.admin_note}` : "."} You can try again.
            </p>
          )}

          <p className="text-[12.5px] text-inksoft">
            Amount to pay: <span className="font-mono text-ink">{money(deal.amount)}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !enough}
              onClick={payWithWallet}
              className="btn-press bg-ink text-paper hover:bg-accent text-[12.5px] font-medium px-3 py-2 rounded-[4px] disabled:opacity-40"
            >
              {busy ? "Working\u2026" : `Pay from wallet${balance !== null ? ` (${money(balance)})` : ""}`}
            </button>
            <button
              type="button"
              onClick={() => { setShowBkash((s) => !s); setError(""); }}
              className="btn-press border border-line text-ink text-[12.5px] px-3 py-2 rounded-[4px]"
            >
              Pay with bKash
            </button>
          </div>

          {balance !== null && !enough && (
            <p className="text-[11.5px] text-inksoft">
              Your wallet balance is too low to pay from it. <a href="/wallet" className="text-accent underline">Add money in your wallet</a>.
            </p>
          )}

          {showBkash && (
            <div className="border border-line rounded-[4px] p-3 space-y-3 bg-paperdim/50">
              <ol className="text-[12.5px] text-ink space-y-1 list-decimal pl-4">
                <li>Open the bKash app and choose <strong>Send Money</strong>.</li>
                <li>
                  Send exactly <strong className="font-mono">{money(deal.amount)}</strong> to{" "}
                  <strong className="font-mono">{bkashNumber || "(number not set)"}</strong>
                  {bkashNumber && (
                    <button type="button" onClick={copyNumber} className="ml-2 text-accent text-[11.5px] underline">
                      {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                  .
                </li>
                <li>Copy the TrxID from your bKash confirmation and enter it below.</li>
              </ol>
              <p className="text-[11.5px] text-inksoft">A different amount or a TrxID that doesn&apos;t match will be rejected.</p>

              <div>
                <label htmlFor="dealTrx" className="text-[12px] text-inksoft block mb-1">bKash TrxID</label>
                <input
                  id="dealTrx"
                  name="dealTrx"
                  autoComplete="off"
                  value={trx}
                  onChange={(e) => setTrx(cleanTrx(e.target.value))}
                  placeholder="e.g. 9C4Q7XX2AB"
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper"
                />
              </div>
              <div>
                <label htmlFor="dealSender" className="text-[12px] text-inksoft block mb-1">The bKash number you sent from</label>
                <input
                  id="dealSender"
                  name="dealSender"
                  inputMode="numeric"
                  autoComplete="off"
                  value={sender}
                  onChange={(e) => setSender(digits(e.target.value, 13))}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper"
                />
              </div>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submitBkash}
                className="btn-press bg-ink text-paper hover:bg-accent text-[12.5px] font-medium px-3 py-2 rounded-[4px] disabled:opacity-40"
              >
                {busy ? "Sending\u2026" : "I've paid, submit TrxID"}
              </button>
            </div>
          )}
        </>
      )}

      {deal.payment_status === "unpaid" && (
        <button type="button" onClick={cancelBeforePayment} className="text-[12px] text-inksoft hover:text-red-500 underline">
          Cancel this deal (nothing has been paid)
        </button>
      )}

      {error && <p className="text-[12.5px] text-red-500">{error}</p>}
    </div>
  );
}