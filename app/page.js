"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { Avatar, Pill, CATEGORIES, initials, IconSearch, StatusBadge } from "../components/ui";
import { budgetLabel, negotiableLabel } from "../lib/format";

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CoverPlaceholder({ category }) {
  const grid = "rgba(255,255,255,0.07)";
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{
        backgroundColor: "#000000",
        color: "rgba(255,255,255,0.55)",
        backgroundImage:
          "linear-gradient(" + grid + " 1px, transparent 1px), linear-gradient(90deg, " + grid + " 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M5 21V9l7-5 7 5v12" />
        <path d="M10 21v-6h4v6" />
      </svg>
      <span className="font-mono text-[10.5px] uppercase tracking-wide">{category}</span>
    </div>
  );
}

function CardCover({ p }) {
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const images = p.images || [];
  const last = images.length - 1;
  const negotiable = negotiableLabel(p);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(e, i) {
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, last));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div
      className="relative h-[156px] shrink-0 border-b border-line group/cover"
      style={{ backgroundColor: "#000000" }}
    >
      {images.length === 0 ? (
        <Link href={"/projects/" + p.id} className="block w-full h-full" aria-label={p.title}>
          <CoverPlaceholder category={p.category} />
        </Link>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="no-scrollbar flex h-full overflow-x-auto snap-x snap-mandatory"
        >
          {images.map((url, i) => (
            <Link
              key={url}
              href={"/projects/" + p.id}
              className="snap-center shrink-0 w-full h-full block"
              aria-label={p.title + " image " + (i + 1)}
            >
              <img
                src={url}
                alt={p.title + " image " + (i + 1)}
                loading="lazy"
                draggable={false}
                className="w-full h-full object-cover"
              />
            </Link>
          ))}
        </div>
      )}

      {negotiable && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10.5px] font-medium pointer-events-none">
          {negotiable}
        </span>
      )}

      {images.length > 1 && (
        <>
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10.5px] font-mono pointer-events-none">
            {index + 1}/{images.length}
          </span>
          {index > 0 && (
            <button
              type="button"
              onClick={(e) => goTo(e, index - 1)}
              aria-label="Previous image"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white text-[16px] leading-none items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity"
            >
              &lsaquo;
            </button>
          )}
          {index < last && (
            <button
              type="button"
              onClick={(e) => goTo(e, index + 1)}
              aria-label="Next image"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white text-[16px] leading-none items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity"
            >
              &rsaquo;
            </button>
          )}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((url, i) => (
              <span
                key={url}
                className={"h-1.5 rounded-full transition-all " + (i === index ? "w-4 bg-white" : "w-1.5 bg-white/55")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCard({ p }) {
  return (
    <div className="tick card-lift bg-surface border border-line rounded-[6px] overflow-hidden flex flex-col w-full max-w-[320px] h-[400px]">
      <CardCover p={p} />

      <Link href={"/projects/" + p.id} className="flex-1 min-h-0 p-4 flex flex-col gap-2 overflow-hidden text-left">
        <div className="flex items-center gap-2">
          <Pill>{p.category}</Pill>
          <StatusBadge status={p.status} />
        </div>

        <h3 className="font-display font-bold text-[15.5px] leading-snug text-ink break-words line-clamp-2">{p.title}</h3>
        <p className="text-[12.5px] text-inksoft leading-snug line-clamp-2 break-words">{p.description}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar tag={initials(p.owner_name)} size={20} src={p.owner_avatar} />
            <span className="text-[12.5px] text-ink font-medium truncate">{p.owner_name}</span>
          </div>
          {p.location && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-inksoft min-w-0 max-w-[48%]">
              <PinIcon />
              <span className="truncate">{p.location}</span>
            </span>
          )}
        </div>

        <div className="mt-auto pt-2 border-t border-line grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-inksoft mb-0.5">Deadline</div>
            <div className="text-[12.5px] font-mono text-ink truncate">{p.deadline}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-inksoft mb-0.5">Budget</div>
            <div className="text-[12.5px] font-mono font-semibold text-accent truncate">{budgetLabel(p)}</div>
          </div>
        </div>
      </Link>
    </div>
  );
}

const GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),320px))] justify-center gap-5";

export default function FeedPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles!projects_owner_id_fkey(display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setProjects([]);
        setLoading(false);
        return;
      }

      // Collect up to 3 images per project, in upload order.
      const imagesByProject = {};
      if (data.length > 0) {
        const { data: fileRows } = await supabase
          .from("project_files")
          .select("project_id, file_path, file_type, created_at")
          .in("project_id", data.map((p) => p.id))
          .order("created_at", { ascending: true });
        if (cancelled) return;
        (fileRows || []).forEach((f) => {
          if (!f.file_type || !f.file_type.startsWith("image/")) return;
          const list = imagesByProject[f.project_id] || (imagesByProject[f.project_id] = []);
          if (list.length >= 3) return;
          list.push(supabase.storage.from("project-files").getPublicUrl(f.file_path).data.publicUrl);
        });
      }

      setProjects(
        data.map((p) => ({
          ...p,
          owner_name: p.profiles?.display_name || "Agent",
          owner_avatar: p.profiles?.avatar_url,
          images: imagesByProject[p.id] || [],
        }))
      );
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => projects.filter((p) => {
    const catOk = cat === "All" || p.category === cat;
    const q = query.trim().toLowerCase();
    const qOk =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.location || "").toLowerCase().includes(q);
    return catOk && qOk;
  }), [projects, cat, query]);

  return (
    <div>
      <section className="border-b border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 pb-14">
          <div className="sheet px-6 md:px-14 pt-14 pb-12 md:pt-20 md:pb-16">
            <div className="bg-slides">
              <div className="bg-slide"></div>
              <div className="bg-slide"></div>
              <div className="bg-slide"></div>
              <div className="bg-slide"></div>
              <div className="bg-slide"></div>
            </div>
            <div className="crop-tl"></div>
            <div className="crop-br"></div>
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] text-accent border border-accent bg-accent/10 px-2.5 py-1 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span> Open for new projects
              </span>
              <h1 className="font-display font-extrabold text-[38px] leading-[1.08] md:text-[56px] md:leading-[1.05] text-ink text-balance break-words">
                Deadlines are knocking at the door?
              </h1>
              <p className="mt-5 text-[16px] md:text-[18px] text-inksoft leading-relaxed max-w-xl">
                Find architecture students, designers and specialists ready to help with your next project.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
                <div className="relative flex-1">
                  <IconSearch size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you need help with?"
                    name="search" autoComplete="off" aria-label="Search projects"
                    className="w-full h-12 pl-11 pr-4 rounded-[4px] border border-line text-black placeholder:text-black/50 text-[14.5px] bg-white" />
                </div>
              </div>
              <div className="flex gap-10 mt-14 flex-wrap">
                <div className="dim-item">
                  <div className="font-display font-bold text-[24px] text-ink">1,200+</div>
                  <div className="font-mono text-[10.5px] text-inksoft mt-1 uppercase tracking-wide">Projects completed</div>
                </div>
                <div className="dim-item">
                  <div className="font-display font-bold text-[24px] text-ink">&#2547;500&ndash;15k</div>
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
            <div className="font-mono text-[11.5px] text-accent mb-4">01 &mdash; POST</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Describe the work</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Title, deadline, budget, and reference files. Takes about two minutes.</p>
          </div>
          <div className="bg-surface p-7">
            <div className="font-mono text-[11.5px] text-accent mb-4">02 &mdash; MATCH</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Hear from agents</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Students message you directly with questions or an offer &mdash; you pick who fits.</p>
          </div>
          <div className="bg-surface p-7">
            <div className="font-mono text-[11.5px] text-accent mb-4">03 &mdash; DELIVER</div>
            <h3 className="font-display font-semibold text-[16px] text-ink mb-2">Accept and pay</h3>
            <p className="text-[13.5px] text-inksoft leading-relaxed">Confirm a price in chat, and mark it complete once the work&apos;s done.</p>
          </div>
        </div>
      </section>

      <section className="sheet-section">
        <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-12">
          <h2 className="font-display font-bold text-[22px] text-ink mb-7">Open projects</h2>

          {loading ? (
            <div className={GRID_CLASS}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border border-line rounded-[6px] overflow-hidden w-full max-w-[320px] h-[400px] animate-pulse">
                  <div className="h-[156px] bg-paperdim"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-20 bg-paperdim rounded-full"></div>
                    <div className="h-4 w-3/4 bg-paperdim rounded"></div>
                    <div className="h-3 w-full bg-paperdim rounded"></div>
                    <div className="h-3 w-5/6 bg-paperdim rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-line rounded-[6px] py-20 text-center text-inksoft">
              <p className="text-[14px]">No projects yet. Be the first to post one!</p>
            </div>
          ) : (
            <div className={GRID_CLASS}>
              {filtered.map((p) => <ProjectCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}