"use client";
import { useEffect, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { money } from "../../../components/ui";

const OUTCOMES = {
  complete: {
    label: "Complete deal",
    help: "Marks the deal and the project as completed. Use this when the agent delivered the work.",
    btn: "bg-ink text-paper hover:bg-accent",
  },
  cancel: {
    label: "Cancel deal",
    help: "Cancels the deal, reopens the project, and declines that agent's offer on it.",
    btn: "bg-red-600 text-white hover:bg-red-700",
  },
  resume: {
    label: "Resume deal",
    help: "Puts the deal back in progress. Nothing else changes.",
    btn: "border border-line text-ink hover:border-ink",
  },
};

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : "";
}

export default function AdminDisputesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [allowed, setAllowed] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [openChat, setOpenChat] = useState(null);
  const [chats, setChats] = useState({});
  const [action, setAction] = useState(null); // { requestId, outcome }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data, error: listError } = await supabase.rpc("admin_list_disputes");
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

  async function toggleChat(row) {
    if (openChat === row.deal_id) {
      setOpenChat(null);
      return;
    }
    setOpenChat(row.deal_id);
    if (!chats[row.deal_id]) {
      const { data, error: chatError } = await supabase.rpc("admin_deal_messages", { p_deal_id: row.deal_id });
      setChats((cur) => ({
        ...cur,
        [row.deal_id]: chatError ? { error: chatError.message } : { list: data || [] },
      }));
    }
  }

  async function confirmAction() {
    if (!action || busy) return;
    setBusy(true);
    setError("");
    const { error: resolveError } = await supabase.rpc("admin_resolve_dispute", {
      p_request_id: action.requestId,
      p_outcome: action.outcome,
      p_note: note.trim(),
    });
    setBusy(false);
    if (resolveError) {
      setError(resolveError.message);
      return;
    }
    setAction(null);
    setNote("");
    await load();
  }

  if (allowed === undefined) {
  return <div className="max-w-4xl mx-auto px-5 py-16 text-inksoft">Loading&hellip;</div>;
  }
  if (!allowed) {
  notFound();
  }

  const openRows = rows.filter((r) => r.request_status === "pending");
  const doneRows = rows.filter((r) => r.request_status !== "pending");
  const shown = tab === "open" ? openRows : doneRows;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <h1 className="font-display font-extrabold text-[24px] text-ink mb-1">Disputes</h1>
      <p className="text-[13.5px] text-inksoft mb-6">Review each case, read the chat, then decide.</p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("open")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "open" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          Needs review ({openRows.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("done")}
          className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${tab === "done" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink"}`}
        >
          Resolved ({doneRows.length})
        </button>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-[14px] text-inksoft">Loading&hellip;</p>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-line rounded-[6px] py-14 text-center text-[14px] text-inksoft">
          {tab === "open" ? "No disputes waiting for review." : "No resolved disputes yet."}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((r) => {
            const chat = chats[r.deal_id];
            const picking = action && action.requestId === r.request_id;
            return (
              <div key={r.request_id} className="border border-line rounded-[6px] bg-surface p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-[16px] text-ink break-words">{r.project_title || "Project"}</h2>
                    <p className="text-[11.5px] text-inksoft font-mono mt-0.5">Raised {fmt(r.raised_at)}</p>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${r.request_status === "pending" ? "border-[var(--amber)] text-[var(--amber)]" : "border-line text-inksoft"}`}
                  >
                    {r.request_status === "pending" ? "Needs review" : "Resolved \u00B7 deal " + r.deal_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Amount</div>
                    <div className="text-[14px] font-mono text-ink">{money(Number(r.amount))}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Raised by</div>
                    <div className="text-[13.5px] text-ink">{r.raised_by_name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Client</div>
                    <div className="text-[13.5px] text-ink">{r.client_name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-inksoft">Agent</div>
                    <div className="text-[13.5px] text-ink">{r.agent_name || "Unknown"}</div>
                  </div>
                </div>

                <div className="mt-4 border-l-2 border-accent pl-3">
                  <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-1">Reason</div>
                 <p className="text-[13.5px] text-ink break-words">{r.reason}</p>
                                   {r.cancel_reason && (
                    <p className="text-[12.5px] text-inksoft break-words mt-2">
                      Earlier, {r.cancel_by_name || "someone"} asked to cancel this deal: &ldquo;{r.cancel_reason}&rdquo;
                    </p>
                  )}
                  {r.cancel_reason && (
                    <p className="text-[12.5px] text-inksoft break-words mt-2">
                      Earlier, {r.cancel_by_name || "someone"} asked to cancel this deal: &ldquo;{r.cancel_reason}&rdquo;
                    </p>
                  )}
                </div>

                {r.request_status !== "pending" && (
                  <div className="mt-3 text-[12.5px] text-inksoft">
                    Resolved {fmt(r.resolved_at)}
                    {r.admin_note ? <span className="block mt-1 text-ink break-words">Note: {r.admin_note}</span> : null}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  <button type="button" onClick={() => toggleChat(r)} className="text-[12.5px] text-accent hover:underline">
                    {openChat === r.deal_id ? "Hide chat" : "View chat"}
                  </button>
                  {r.project_id && (
                    <a href={"/projects/" + r.project_id} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-accent hover:underline">
                      Open project
                    </a>
                  )}
                </div>

                {openChat === r.deal_id && (
                  <div className="mt-3 border border-line rounded-[4px] bg-paperdim/50 p-3 max-h-72 overflow-y-auto space-y-2">
                    {!chat && <p className="text-[12.5px] text-inksoft">Loading&hellip;</p>}
                    {chat?.error && <p className="text-[12.5px] text-red-500">{chat.error}</p>}
                    {chat?.list && chat.list.length === 0 && <p className="text-[12.5px] text-inksoft">No messages.</p>}
                    {chat?.list && chat.list.map((m, i) => {
                      const url = m.file_path ? supabase.storage.from("project-files").getPublicUrl(m.file_path).data.publicUrl : null;
                      return (
                        <div key={i} className="text-[12.5px]">
                          <span className="font-medium text-ink">{m.sender_name || "Unknown"}</span>
                          <span className="text-[10.5px] text-inksoft font-mono ml-2">{fmt(m.sent_at)}</span>
                          <div className="text-ink break-words">
                            {m.content
                              ? m.content
                              : url
                                ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{"File: " + (m.file_name || "attachment")}</a>
                                : "Shared a project"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {r.request_status === "pending" && !picking && (
                  <div className="flex items-center gap-2 mt-5 flex-wrap">
                    {Object.keys(OUTCOMES).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setAction({ requestId: r.request_id, outcome: key }); setNote(""); setError(""); }}
                        className={`btn-press text-[13px] font-medium px-4 py-2 rounded-[4px] ${OUTCOMES[key].btn}`}
                      >
                        {OUTCOMES[key].label}
                      </button>
                    ))}
                  </div>
                )}

                {picking && (
                  <div className="mt-5 border border-line rounded-[4px] p-4 bg-paperdim/50 space-y-3">
                    <div className="text-[13.5px] text-ink font-medium">{OUTCOMES[action.outcome].label}?</div>
                    <p className="text-[12.5px] text-inksoft">{OUTCOMES[action.outcome].help} Both people will be notified.</p>
                    <div>
                      <label htmlFor={"note-" + r.request_id} className="text-[12px] text-inksoft block mb-1">Note (optional, for your records)</label>
                      <textarea
                        id={"note-" + r.request_id}
                        name="adminNote"
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 500))}
                        rows={2}
                        className="w-full px-3 py-2 rounded-[4px] border border-line text-[13px] text-ink resize-none bg-paper"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={confirmAction}
                        className={`btn-press text-[13px] font-medium px-4 py-2 rounded-[4px] disabled:opacity-50 ${OUTCOMES[action.outcome].btn}`}
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