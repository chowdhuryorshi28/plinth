"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Avatar, Pill, money, initials, PrimaryButton, IconPlus, IconBriefcase, IconCheck } from "../../components/ui";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [myProjects, setMyProjects] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  useEffect(() => {
    if (user === null) router.push("/login");
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setProfile(data));
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMyProjects(data || []));
  }, [user]);

  if (!user || !profile) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Avatar tag={initials(profile.display_name)} size={44} />
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-ink">{profile.display_name}'s dashboard</h1>
            <p className="text-[13px] text-inksoft font-mono">{profile.agent_code}</p>
          </div>
        </div>
        <PrimaryButton onClick={() => router.push("/post")}><IconPlus size={15} /> Post a Project</PrimaryButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <IconBriefcase size={16} className="text-inksoft mb-4" />
          <div className="font-display font-extrabold text-[22px] text-ink">{myProjects.length}</div>
          <div className="text-[12px] text-inksoft mt-1">Projects Posted</div>
        </div>
        <div className="border border-line rounded-[6px] bg-surface p-5">
          <IconCheck size={16} className="text-inksoft mb-4" />
          <div className="font-display font-extrabold text-[22px] text-ink">{profile.completed_count}</div>
          <div className="text-[12px] text-inksoft mt-1">Projects Completed</div>
        </div>
      </div>

      <h2 className="font-display font-bold text-[17px] text-ink mb-4">My Projects</h2>
      {myProjects.length === 0 ? (
        <p className="text-[14px] text-inksoft">You haven't posted anything yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myProjects.map((p) => (
            <a key={p.id} href={`/projects/${p.id}`} className="border border-line rounded-[6px] bg-surface p-5 block hover:border-accent transition-colors">
              <Pill className="mb-3">{p.category}</Pill>
              <h3 className="font-display font-bold text-[15px] text-ink mb-2">{p.title}</h3>
              <div className="text-[13px] font-mono text-accent">{money(p.budget)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
