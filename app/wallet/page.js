"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { money } from "../../components/ui";

const KIND_LABEL = {
  topup: "Top-up",
  deal_payment: "Paid for a deal",
  refund: "Refund",
  earning: "Earnings",
  withdrawal: "Withdrawal",
  withdrawal_refund: "Withdrawal returned",
  adjustment: "Adjustment",
};
const STATUS_STYLE = {
  pending: "border-[var(--amber)] text-[var(--amber)]",
  requested: "border-[var(--amber)] text-[var(--amber)]",
  approved: "border-accent text-accent",
  paid: "border-accent text-accent",
  rejected: "border-red-500 text-red-500",
};
const STATUS_TEXT = {
  pending: "Under review",
  requested: "Requested",
  approved: "Approved",
  paid: "Paid",
  rejected: "Not accepted",
};

const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";
const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);
const cleanTrx = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const signed = (n) => (n < 0 ? "-" : "+") + money(Math.abs(n));

function Msg({ msg }) {
  if (!msg.text) return null;
  return <p className={`text-[12.5px] ${msg.type === "error" ? "text-red-500" : "text-accent"}`}>{msg.text}</p>;
}

export default function WalletPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ available: 0, pending: 0 });
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [settings, setSettings] = useState({});
  const [copied, setCopied] = useState(false);

  const [topAmount, setTopAmount] = useState("");
  const [topTrx, setTopTrx] = useState("");
  const [topSender, setTopSender] = useState("");
  const [topBusy, setTopBusy] = useState(false);
  const [topMsg, setTopMsg] = useState({ type: "", text: "" });

  const [wdAmount, setWdAmount] = useState("");
  const [wdNumber, setWdNumber] = useState("");
  const [wdBusy, setWdBusy] = useState(false);
  const [wdMsg, setWdMsg] = useState({ type: "", text: "" });

  async function load() {
    const [sum, ent, pay, wd, set] = await Promise.all([
      supabase.rpc("wallet_summary"),
      supabase.from("wallet_entries").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("platform_settings").select("key, value"),
    ]);
    const row = Array.isArray(sum.data) ? sum.data[0] : null;
    setSummary({ available: Number(row?.available || 0), pending: Number(row?.pending || 0) });
    setEntries(ent.data || []);
    setPayments(pay.data || []);
    setWithdrawals(wd.data || []);
    const map = {};
    (set.data || []).forEach((s) => { map[s.key] = s.value; });
    setSettings(map);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      load();
    });
  }, []);

  const minTopup = Number(settings.min_topup || 100);
  const minWithdrawal = Number(settings.min_withdrawal || 200);
  const holdDays = Number(settings.payout_hold_days || 5);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(settings.bkash_number || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // the number is still visible on screen
    }
  }

  async function submitTopup() {
    if (topBusy) return;
    setTopMsg({ type: "", text: "" });
    setTopBusy(true);
    const { error } = await supabase.rpc("submit_topup", {
      p_amount: Number(topAmount),
      p_trx_id: topTrx,
      p_sender: topSender,
    });
    setTopBusy(false);
    if (error) {
      setTopMsg({ type: "error", text: error.message });
      return;
    }
    setTopAmount("");
    setTopTrx("");
    setTopSender("");
    setTopMsg({ type: "ok", text: "Sent for review. Your wallet is credited once the payment is confirmed." });
    load();
  }

  async function submitWithdrawal() {
    if (wdBusy) return;
    setWdMsg({ type: "", text: "" });
    setWdBusy(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      p_amount: Number(wdAmount),
      p_number: wdNumber,
    });
    setWdBusy(false);
    if (error) {
      setWdMsg({ type: "error", text: error.message });
      return;
    }
    setWdAmount("");
    setWdNumber("");
    setWdMsg({ type: "ok", text: "Request sent. The money will be sent to your bKash number and you'll be notified." });
    load();
  }

  if (user === undefined || loading) {
    return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading&hellip;</div>;
  }

  const topValid = Number(topAmount) >= minTopup && topTrx.length >= 8 && topSender.length >= 11;
  const wdValid = Number(wdAmount) >= minWithdrawal && Number(wdAmount) <= summary.available && wdNumber.length >= 11;
  const now = Date.now();

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display font-extrabold text-[26px] text-ink">Wallet</h1>
        <p className="text-[13.5px] text-inksoft mt-1">Your balance, top-ups, earnings and withdrawals.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Available</div>
          <div className="text-[28px] font-mono font-bold text-ink mt-1">{money(summary.available)}</div>
          <div className="text-[12px] text-inksoft mt-1">Ready to spend or withdraw</div>
        </div>
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Pending release</div>
          <div className="text-[28px] font-mono font-bold text-inksoft mt-1">{money(summary.pending)}</div>
          <div className="text-[12px] text-inksoft mt-1">Earnings are released {holdDays} working days after a deal is completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-line rounded-[6px] bg-surface p-5 space-y-3">
          <h2 className="font-display font-bold text-[15px] text-ink">Add money</h2>
          <ol className="text-[12.5px] text-ink space-y-1 list-decimal pl-4">
            <li>Open bKash and choose <strong>Send Money</strong>.</li>
            <li>
              Send to <strong className="font-mono">{settings.bkash_number || "(number not set)"}</strong>
              {settings.bkash_number && (
                <button type="button" onClick={copyNumber} className="ml-2 text-accent text-[11.5px] underline">
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              .
            </li>
            <li>Enter the amount and the TrxID below.</li>
          </ol>
          <div>
            <label htmlFor="topAmount" className="text-[12px] text-inksoft block mb-1">Amount sent (min {money(minTopup)})</label>
            <input id="topAmount" name="topAmount" inputMode="numeric" autoComplete="off" value={topAmount}
              onChange={(e) => setTopAmount(digits(e.target.value, 6))} placeholder="e.g. 2000"
              className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper" />
          </div>
          <div>
            <label htmlFor="topTrx" className="text-[12px] text-inksoft block mb-1">bKash TrxID</label>
            <input id="topTrx" name="topTrx" autoComplete="off" value={topTrx}
              onChange={(e) => setTopTrx(cleanTrx(e.target.value))} placeholder="e.g. 9C4Q7XX2AB"
              className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper" />
          </div>
          <div>
            <label htmlFor="topSender" className="text-[12px] text-inksoft block mb-1">The bKash number you sent from</label>
            <input id="topSender" name="topSender" inputMode="numeric" autoComplete="off" value={topSender}
              onChange={(e) => setTopSender(digits(e.target.value, 13))} placeholder="01XXXXXXXXX"
              className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper" />
          </div>
          <button type="button" disabled={!topValid || topBusy} onClick={submitTopup}
            className="btn-press w-full bg-ink text-paper hover:bg-accent text-[13px] font-medium px-4 py-2.5 rounded-[4px] disabled:opacity-40">
            {topBusy ? "Sending\u2026" : "Submit top-up"}
          </button>
          <Msg msg={topMsg} />
        </div>

        <div className="border border-line rounded-[6px] bg-surface p-5 space-y-3">
          <h2 className="font-display font-bold text-[15px] text-ink">Withdraw</h2>
          <p className="text-[12.5px] text-inksoft">
            You can withdraw up to <span className="font-mono text-ink">{money(summary.available)}</span> (min {money(minWithdrawal)}).
            We send the money to your bKash number by hand, so it can take a little while.
          </p>
          <div>
            <label htmlFor="wdAmount" className="text-[12px] text-inksoft block mb-1">Amount</label>
            <input id="wdAmount" name="wdAmount" inputMode="numeric" autoComplete="off" value={wdAmount}
              onChange={(e) => setWdAmount(digits(e.target.value, 6))} placeholder="e.g. 1500"
              className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper" />
          </div>
          <div>
            <label htmlFor="wdNumber" className="text-[12px] text-inksoft block mb-1">Send to this bKash number</label>
            <input id="wdNumber" name="wdNumber" inputMode="numeric" autoComplete="off" value={wdNumber}
              onChange={(e) => setWdNumber(digits(e.target.value, 13))} placeholder="01XXXXXXXXX"
              className="w-full h-10 px-3 rounded-[4px] border border-line text-[13px] text-ink font-mono bg-paper" />
          </div>
          <button type="button" disabled={!wdValid || wdBusy} onClick={submitWithdrawal}
            className="btn-press w-full bg-ink text-paper hover:bg-accent text-[13px] font-medium px-4 py-2.5 rounded-[4px] disabled:opacity-40">
            {wdBusy ? "Sending\u2026" : "Request withdrawal"}
          </button>
          <Msg msg={wdMsg} />
        </div>
      </div>

      {(payments.length > 0 || withdrawals.length > 0) && (
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <h2 className="font-display font-bold text-[15px] text-ink mb-3">Requests</h2>
          <div className="divide-y divide-line">
            {payments.map((p) => (
              <div key={"p-" + p.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    {p.purpose === "topup" ? "Wallet top-up" : "Deal payment"} &middot; <span className="font-mono">{money(p.amount)}</span>
                  </div>
                  <div className="text-[11.5px] text-inksoft font-mono">TrxID {p.trx_id} &middot; {fmtDate(p.created_at)}</div>
                  {p.status === "rejected" && p.admin_note && (
                    <div className="text-[11.5px] text-red-500 break-words">{p.admin_note}</div>
                  )}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status]}`}>{STATUS_TEXT[p.status]}</span>
              </div>
            ))}
            {withdrawals.map((w) => (
              <div key={"w-" + w.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    Withdrawal &middot; <span className="font-mono">{money(w.amount)}</span> to {w.bkash_number}
                  </div>
                  <div className="text-[11.5px] text-inksoft font-mono">
                    {fmtDate(w.created_at)}{w.payout_trx_id ? " \u00B7 TrxID " + w.payout_trx_id : ""}
                  </div>
                  {w.status === "rejected" && w.admin_note && (
                    <div className="text-[11.5px] text-red-500 break-words">{w.admin_note}</div>
                  )}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[w.status]}`}>{STATUS_TEXT[w.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-line rounded-[6px] bg-surface p-5">
        <h2 className="font-display font-bold text-[15px] text-ink mb-3">History</h2>
        {entries.length === 0 ? (
          <p className="text-[13px] text-inksoft">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {entries.map((e) => (
              <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">{KIND_LABEL[e.kind] || e.kind}</div>
                  <div className="text-[11.5px] text-inksoft break-words">{e.note}</div>
                  <div className="text-[11px] text-inksoft font-mono">
                    {fmtDate(e.created_at)}
                    {new Date(e.available_at).getTime() > now ? " \u00B7 available " + fmtDate(e.available_at) : ""}
                  </div>
                </div>
                <div className={`text-[14px] font-mono font-semibold shrink-0 ${e.amount < 0 ? "text-ink" : "text-accent"}`}>
                  {signed(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}