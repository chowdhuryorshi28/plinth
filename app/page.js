"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { Avatar, Pill, CATEGORIES, money, initials, IconSearch, StatusBadge } from "../components/ui";

function ProjectCard({ p }) {
  return (
    <Link href={`/projects/${p.id}`}
          className="tick card-lift text-left bg-surface border border-line rounded-[6px] p-5 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pill>{p.category}</Pill>
          <StatusBadge status={p.status} />
        </div>
        <span className="text-[11.5px] text-inksoft font-mono shrink-0">
          {new Date(p.created_at).toLocaleDateString()}
        </span>
      </div>
      <h3 className="font-display font-bold text-[17px] leading-snug text-ink">{p.title}</h3>
      <p className="text-[13.5px] text-inksoft leading-relaxed line-clamp-3">{p.description}</p>
      <div className="flex items-center gap-2 pt-1">
        <Avatar tag={initials(p.owner_name)} size={22} />
        <span className="text-[13px] text-ink font-medium">{p.owner_name}</span>
      </div>
      <div className="mt-auto pt-3 border-t border-line grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-0.5">Deadline</div>
          <div className="text-[13px] font-mono text-ink">{p.deadline}</div>
        </div>
            <div>
          <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-0.5">Budget</div>
          <div className="text-[13px] font-mono font-semibold text-accent">{money(p.budget)}</div>
        </div>
      </div>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink hover:text-accent">
        View Project →
      </span>
    </Link>
  );
}

export default function FeedPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Join each project with its owner's display name from "profiles".
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles!projects_owner_id_fkey(display_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) { console.error(error); setProjects([]); }
      else setProjects(data.map((p) => ({ ...p, owner_name: p.profiles?.display_name || "Agent" })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => projects.filter((p) => {
    const catOk = cat === "All" || p.category === cat;
    const q = query.trim().toLowerCase();
    const qOk = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    return catOk && qOk;
  }), [projects, cat, query]);

  return (
    <div>
          <section className="border-b border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 pb-14">
          <div className="sheet px-6 md:px-14 pt-14 pb-12 md:pt-20 md:pb-16">
            <div className="crop-tl"></div>
            <div className="crop-br"></div>
            <div className="max-w-2xl relative">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] text-accent border border-accent bg-accent/10 px-2.5 py-1 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Open for new projects
              </span>
              <h1 className="font-display font-extrabold text-[38px] leading-[1.08] md:text-[56px] md:leading-[1.05] text-ink">
                Deadlines are knocking at the door?
              </h1>
              <p className="mt-5 text-[16px] md:text-[18px] text-inksoft leading-relaxed max-w-xl">
                Find architecture students, designers and specialists ready to help with your next project.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
                              <div className="relative flex-1">
                <IconSearch size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you need help with?"
                  className="w-full h-12 pl-11 pr-4 rounded-[4px] border border-line text-black placeholder:text-black/50 text-[14.5px] bg-white" />
              </div>
              </div>
              <div className="flex gap-10 mt-14 flex-wrap">
                <div className="dim-item">
                  <div className="font-display font-bold text-[24px] text-ink">1,200+</div>
                  <div className="font-mono text-[10.5px] text-inksoft mt-1 uppercase tracking-wide">Projects completed</div>
                </div>
                <div className="dim-item">
                  <div className="font-display font-bold text-[24px] text-ink">৳500–15k</div>
                  <div className="font-mono text-[10.5px] text-inksoft mt-1 uppercase tracking-wide">Typical budget range</div>
                </div>
                <div className="dim-item">
                  <div className="font-display font-bold text-[24px] text-ink">6 hrs</div>
                  <div className="font-mono text-[10.5px] text-inksoft mt-1 uppercase tracking-wide">Avg. time to first reply</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 bg-paper/95 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-3 flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`shrink-0 text-[13px] px-3.5 py-1.5 rounded-[4px] border transition-colors ${cat === c ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink hover:border-ink"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
            <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 border-b border-line">
        <h2 className="font-display font-bold text-[22px] text-ink mb-8">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line rounded-[8px] overflow-hidden">
          <div className="bg-surface p-7">
            <div className="font-mono text-[11.5px] text-accent mb-4">01 — POST</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Describe the work</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Title, deadline, budget, and reference files. Takes about two minutes.</p>
          </div>
          <div className="bg-surface p-7">
            <div className="font-mono text-[11.5px] text-accent mb-4">02 — MATCH</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Hear from agents</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Students message you directly with questions or an offer — you pick who fits.</p>
          </div>
          <div className="bg-surface p-7">
            <div className="font-mono text-[11.5px] text-accent mb-4">03 — DELIVER</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Accept and pay</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Confirm a price in chat, and mark it complete once the work's done.</p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <h2 className="font-display font-bold text-[22px] text-ink mb-7">Open projects</h2>
        
               {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border border-line rounded-[6px] p-5 h-56 animate-pulse space-y-4">
                <div className="h-5 w-20 bg-paperdim rounded-full"></div>
                <div className="h-4 w-3/4 bg-paperdim rounded"></div>
                <div className="h-3 w-full bg-paperdim rounded"></div>
                <div className="h-3 w-5/6 bg-paperdim rounded"></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-line rounded-[6px] py-20 text-center text-inksoft">
            <p className="text-[14px]">No projects yet. Be the first to post one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
