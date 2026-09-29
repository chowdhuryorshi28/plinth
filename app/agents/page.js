"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { Avatar, initials, IconSearch, IconStar, SKILL_OPTIONS } from "../../components/ui";

function AgentCard({ a }) {
  const rating = a.rating_count ? (a.rating_sum / a.rating_count).toFixed(1) : null;
  return (
    <Link href={`/agents/${a.id}`}
      className="tick card-lift text-left bg-surface border border-line rounded-[6px] p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <Avatar tag={initials(a.display_name)} size={44} src={a.avatar_url} />
        <div className="min-w-0">
          <h3 className="font-display font-bold text-[15.5px] text-ink truncate">{a.display_name}</h3>
          {a.specialty && <p className="text-[12.5px] text-accent truncate">{a.specialty}</p>}
        </div>
      </div>
      {a.bio && <p className="text-[13px] text-inksoft leading-relaxed line-clamp-2">{a.bio}</p>}
      <div className="flex flex-wrap gap-1.5">
        {(a.skills || []).slice(0, 4).map((s) => (
          <span key={s} className="text-[11px] text-inksoft bg-paperdim px-2 py-0.5 rounded-[3px] border border-line">{s}</span>
        ))}
      </div>
      <div className="mt-auto pt-3 border-t border-line flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] text-ink font-medium">
          <IconStar size={14} className="text-accent" /> {rating || "New"}
        </div>
        <div className="text-[12px] text-inksoft">{a.completed_count} completed</div>
      </div>
    </Link>
  );
}

export default function AgentsDirectoryPage() {
  const supabase = createClient();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("All");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .order("rating_sum", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setAgents(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => agents.filter((a) => {
    const skillOk = skill === "All" || (a.skills || []).includes(skill);
    const q = query.trim().toLowerCase();
    const qOk = !q || a.display_name.toLowerCase().includes(q) || (a.specialty || "").toLowerCase().includes(q);
    return skillOk && qOk;
  }), [agents, query, skill]);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <h1 className="font-display font-extrabold text-[28px] text-ink mb-2">Find an agent</h1>
      <p className="text-[14px] text-inksoft mb-7">Browse students and specialists by skill and rating.</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-inksoft" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or specialty…"
            className="w-full h-11 pl-10 pr-4 rounded-[4px] border border-line text-ink text-[14px] bg-surface" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-8">
        <button onClick={() => setSkill("All")}
          className={`shrink-0 text-[13px] px-3.5 py-1.5 rounded-[4px] border transition-colors ${skill === "All" ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink hover:border-ink"}`}>
          All
        </button>
        {SKILL_OPTIONS.map((s) => (
          <button key={s} onClick={() => setSkill(s)}
            className={`shrink-0 text-[13px] px-3.5 py-1.5 rounded-[4px] border transition-colors ${skill === s ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink hover:border-ink"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border border-line rounded-[6px] p-5 h-44 animate-pulse space-y-4">
              <div className="h-11 w-11 rounded-full bg-paperdim"></div>
              <div className="h-4 w-2/3 bg-paperdim rounded"></div>
              <div className="h-3 w-full bg-paperdim rounded"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-[6px] py-20 text-center text-inksoft">
          <p className="text-[14px]">No agents match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((a) => <AgentCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}