"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { Avatar, Pill, money, initials, IconArrowLeft, IconCheck } from "../../../components/ui";


export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [p, setP] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.from("projects").select("*, profiles!projects_owner_id_fkey(display_name, agent_code)")
      .eq("id", id).single()
      .then(({ data }) => { if (!cancelled) setP(data || null); });
    return () => { cancelled = true; };
  }, [id]);

  if (p === undefined) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  if (p === null) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Project not found.</div>;

  const ownerName = p.profiles?.display_name || "Agent";

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
      <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 text-[13.5px] text-inksoft hover:text-ink mb-8">
        <IconArrowLeft size={15} /> Back to projects
      </button>

      <Pill className="mb-4">{p.category}</Pill>
      <h1 className="font-display font-extrabold text-[28px] md:text-[34px] text-ink leading-tight max-w-2xl">{p.title}</h1>
      <div className="flex items-center gap-3 mt-4 mb-10">
        <Avatar tag={initials(ownerName)} size={30} />
        <div>
          <div className="text-[13.5px] text-ink font-medium">Posted by {ownerName}</div>
          <div className="text-[12px] text-inksoft">{new Date(p.created_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          <div>
            <h2 className="font-display font-bold text-[15px] text-ink mb-3">Project description</h2>
            <p className="text-[14.5px] text-inksoft leading-relaxed">{p.description}</p>
          </div>
          {p.requirements?.length > 0 && (
            <div>
              <h2 className="font-display font-bold text-[15px] text-ink mb-3">Requirements</h2>
              <ul className="space-y-2.5">
                {p.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-[14px] text-ink">
                    <IconCheck size={14} className="mt-1 text-accent shrink-0" />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="border border-line rounded-[6px] bg-surface p-5 space-y-5">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-1">Deadline</div>
              <div className="text-[15px] font-mono text-ink">{p.deadline}</div>
            </div>
            <div className="h-px bg-line"></div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-1">Estimated work</div>
              <div className="text-[15px] font-mono text-ink">{p.workload}</div>
            </div>
            <div className="h-px bg-line"></div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-1">Budget</div>
              <div className="text-[22px] font-mono font-bold text-accent">{money(p.budget)}</div>
            </div>
            {p.software?.length > 0 && (
              <>
                <div className="h-px bg-line"></div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-inksoft mb-2">Required skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.software.map((s) => <span key={s} className="text-[11.5px] text-ink bg-paperdim px-2 py-1 rounded-[3px] border border-line">{s}</span>)}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
           </div>

      <div className="mt-10">
        <MessageButton project={p} router={router} supabase={supabase} />
      </div>
    </div>
  );
}

function MessageButton({ project, router, supabase }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  if (user === undefined) return null;
  if (!user) return <div className="text-[13.5px] text-inksoft">Log in to message about this project.</div>;

  const isOwner = user.id === project.owner_id;

  async function openChat() {
    if (isOwner) {
      router.push("/messages");
      return;
    }
    const { data: existing } = await supabase
      .from("threads")
      .select("id")
      .eq("project_id", project.id)
      .eq("helper_id", user.id)
      .maybeSingle();
    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }
    const { data } = await supabase
      .from("threads")
      .insert({ project_id: project.id, owner_id: project.owner_id, helper_id: user.id })
      .select()
      .single();
    router.push(`/messages/${data.id}`);
  }

  return (
    <button onClick={openChat} className="btn-press bg-ink text-paper hover:bg-accent font-medium text-[14px] px-5 py-2.5 rounded-[4px]">
      {isOwner ? "View Messages" : "Offer to Help"}
    </button>
  );
}
