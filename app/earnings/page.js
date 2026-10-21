"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { money } from "../../components/ui";

const DEAL_CHIP = {
  awaiting_payment: { label: "Awaiting payment", cls: "border-[var(--amber)] text-[var(--amber)]" },
  accepted: { label: "In progress", cls: "border-accent text-accent" },
  completed: { label: "Completed", cls: "border-accent text-accent" },
  cancelled: { label: "Cancelled", cls: "border-red-500 text-red-500" },
  disputed: { label: "Under review", cls: "border-[var(--amber)] text-[var(--amber)]" },
};
const REQUEST_STYLE = {
  pending: "border-[var(--amber)] text-[var(--amber)]",
  requested: "border-[var(--amber)] text-[var(--amber)]",
  approved: "border-accent text-accent",
  paid: "border-accent text-accent",
  rejected: "border-red-500 text-red-500",
};
const REQUEST_TEXT = {
  pending: "Under review",
  requested: "Requested",
  approved: "Approved",
  paid: "Paid",
  rejected: "Not accepted",
};
const ENTRY_LABEL = {
  earning: "Earnings",
  refund: "Refund",
  withdrawal: "Withdrawal",
  withdrawal_refund: "Withdrawal returned",
  topup: "Money added",
  deal_payment: "Paid for a deal",
  adjustment: "Adjustment",
};

const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";
const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);
const signed = (n) => (n < 0 ? "-" : "+") + money(Math.abs(n));
const sum = (list, pick) => list.reduce((total, item) => total + Number(pick(item) || 0), 0);

function Msg({ msg }) {
  if (!msg.text) return null;
  return <p className={`text-[12.5px] ${msg.type === "error" ? "text-red-500" : "text-accent"}`}>{msg.text}</p>;
}

export default function EarningsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ available: 0, pending: 0 });
  const [deals, setDeals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [settings, setSettings] = useState({});

  const [wdAmount, setWdAmount] = useState("");
  const [wdNumber, setWdNumber] = useState("");
  const [wdBusy, setWdBusy] = useState(false);
  const [wdMsg, setWdMsg] = useState({ type: "", text: "" });

  async function load() {
    const [sum1, dl, ent, pay, wd, set] = await Promise.all([
      supabase.rpc("wallet_summary"),
      supabase
        .from("deals")
        .select("*, projects(title), owner:profiles!deals_owner_id_fkey(display_name), helper:profiles!deals_helper_id_fkey(display_name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("wallet_entries").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("platform_settings").select("key, value"),
    ]);
    const row = Array.isArray(sum1.data) ? sum1.data[0] : null;
    setSummary({ available: Number(row?.available || 0), pending: Number(row?.pending || 0) });
    setDeals(dl.data || []);
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

  const minWithdrawal = Number(settings.min_withdrawal || 200);
  const holdDays = Number(settings.payout_hold_days || 5);
  const testMode = Number(settings.payout_hold_minutes || 0) > 0;
  const holdText = testMode
    ? "a few minutes after the client marks the deal complete (test mode)"
    : `${holdDays} working days after the client marks the deal complete`;

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

  const asAgent = deals.filter((d) => d.helper_id === user.id);
  const asClient = deals.filter((d) => d.owner_id === user.id);
  const inProgress = sum(asAgent.filter((d) => d.status === "accepted" && d.payment_status === "paid"), (d) => d.payout);
  const totalEarned = sum(entries.filter((e) => e.kind === "earning"), (e) => e.amount);
  const paidOut = sum(withdrawals.filter((w) => w.status === "paid"), (w) => w.amount);
  const spent = sum(
    asClient.filter((d) => ["accepted", "completed"].includes(d.status) && d.payment_status === "paid"),
    (d) => d.amount
  );
  const refunded = sum(entries.filter((e) => e.kind === "refund"), (e) => e.amount);
  const wdValid = Number(wdAmount) >= minWithdrawal && Number(wdAmount) <= summary.available && wdNumber.length >= 11;
  const now = Date.now();

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display font-extrabold text-[26px] text-ink">Earnings</h1>
        <p className="text-[13.5px] text-inksoft mt-1">
          Money from your deals, what is waiting to be released, and what has been paid out to you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">In progress</div>
          <div className="text-[24px] font-mono font-bold text-ink mt-1">{money(inProgress)}</div>
          <div className="text-[12px] text-inksoft mt-1">From deals not yet completed, after the 10% fee</div>
        </div>
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Pending release</div>
          <div className="text-[24px] font-mono font-bold text-inksoft mt-1">{money(summary.pending)}</div>
          <div className="text-[12px] text-inksoft mt-1">Released {holdText}</div>
        </div>
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Available to withdraw</div>
          <div className="text-[24px] font-mono font-bold text-accent mt-1">{money(summary.available)}</div>
          <div className="text-[12px] text-inksoft mt-1">Released earnings and refunds</div>
        </div>
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Paid out</div>
          <div className="text-[24px] font-mono font-bold text-ink mt-1">{money(paidOut)}</div>
          <div className="text-[12px] text-inksoft mt-1">Sent to your bKash. Total earned: {money(totalEarned)}</div>
        </div>
      </div>

      {asClient.length > 0 && (
        <div className="border border-line rounded-[6px] bg-surface p-5 flex flex-wrap gap-8">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Spent on deals (as a client)</div>
            <div className="text-[18px] font-mono font-bold text-ink mt-1">{money(spent)}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Refunded</div>
            <div className="text-[18px] font-mono font-bold text-ink mt-1">{money(refunded)}</div>
          </div>
        </div>
      )}

      <div className="border border-line rounded-[6px] bg-surface p-5 space-y-3">
        <h2 className="font-display font-bold text-[15px] text-ink">Withdraw</h2>
        <p className="text-[12.5px] text-inksoft">
          You can withdraw up to <span className="font-mono text-ink">{money(summary.available)}</span> (minimum {money(minWithdrawal)}).
          We send the money to your bKash number by hand, so it can take a little while.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
        <button type="button" disabled={!wdValid || wdBusy} onClick={submitWithdrawal}
          className="btn-press bg-ink text-paper hover:bg-accent text-[13px] font-medium px-5 py-2.5 rounded-[4px] disabled:opacity-40">
          {wdBusy ? "Sending\u2026" : "Request withdrawal"}
        </button>
        <Msg msg={wdMsg} />
      </div>

      <div className="border border-line rounded-[6px] bg-surface p-5">
        <h2 className="font-display font-bold text-[15px] text-ink mb-3">Your deals</h2>
        {deals.length === 0 ? (
          <p className="text-[13px] text-inksoft">No deals yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {deals.map((d) => {
              const mine = d.helper_id === user.id;
              const chip = DEAL_CHIP[d.status] || DEAL_CHIP.accepted;
              const other = mine ? d.owner?.display_name : d.helper?.display_name;
              const counted = ["accepted", "completed"].includes(d.status) && d.payment_status === "paid";
              return (
                <div key={d.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-ink break-words">{d.projects?.title || "Project"}</div>
                    <div className="text-[11.5px] text-inksoft">
                      {mine ? "You are the agent" : "You are the client"} &middot; with {other || "someone"} &middot; {fmtDate(d.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.label}</span>
                    <span className={`text-[14px] font-mono font-semibold ${counted ? (mine ? "text-accent" : "text-ink") : "text-inksoft"}`}>
                      {mine ? "+" : "-"}{money(mine ? d.payout : d.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11.5px] text-inksoft mt-3">
          Cancelled deals and deals still waiting for payment are shown here, but they are not counted in your totals.
        </p>
      </div>

      {(payments.length > 0 || withdrawals.length > 0) && (
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <h2 className="font-display font-bold text-[15px] text-ink mb-3">Payments and payouts</h2>
          <div className="divide-y divide-line">
            {payments.map((p) => (
              <div key={"p-" + p.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    {p.purpose === "topup" ? "Money added" : "Payment for a deal"} &middot; <span className="font-mono">{money(p.amount)}</span>
                  </div>
                  <div className="text-[11.5px] text-inksoft font-mono">TrxID {p.trx_id} &middot; {fmtDate(p.created_at)}</div>
                  {p.status === "rejected" && p.admin_note && (
                    <div className="text-[11.5px] text-red-500 break-words">{p.admin_note}</div>
                  )}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${REQUEST_STYLE[p.status]}`}>{REQUEST_TEXT[p.status]}</span>
              </div>
            ))}
            {withdrawals.map((w) => (
              <div key={"w-" + w.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">
                    Payout &middot; <span className="font-mono">{money(w.amount)}</span> to {w.bkash_number}
                  </div>
                  <div className="text-[11.5px] text-inksoft font-mono">
                    {fmtDate(w.created_at)}{w.payout_trx_id ? " \u00B7 TrxID " + w.payout_trx_id : ""}
                  </div>
                  {w.status === "rejected" && w.admin_note && (
                    <div className="text-[11.5px] text-red-500 break-words">{w.admin_note}</div>
                  )}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${REQUEST_STYLE[w.status]}`}>{REQUEST_TEXT[w.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-line rounded-[6px] bg-surface p-5">
        <h2 className="font-display font-bold text-[15px] text-ink mb-3">History</h2>
        {entries.length === 0 ? (
          <p className="text-[13px] text-inksoft">No earnings or refunds yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {entries.map((e) => (
              <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">{ENTRY_LABEL[e.kind] || e.kind}</div>
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