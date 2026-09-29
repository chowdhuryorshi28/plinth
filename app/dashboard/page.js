"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Avatar, Pill, money, initials, PrimaryButton, IconPlus, IconBriefcase, IconCheck, IconStar, StatusBadge } from "../../components/ui";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [myProjects, setMyProjects] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [myDeals, setMyDeals] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  useEffect(() => {
    if (user === null) router.push("/login");
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setProfile(data));
    supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMyProjects(data || []));
    supabase.from("portfolio_items").select("*").eq("profile_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setPortfolio(data || []));
    supabase.from("deals").select("*, projects(title, id)").eq("helper_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMyDeals(data || []));
  }, [user]);

  if (!user || !profile) {
    return (
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 animate-pulse">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-full bg-paperdim"></div>
          <div className="space-y-2">
            <div className="h-5 w-48 bg-paperdim rounded"></div>
            <div className="h-3 w-24 bg-paperdim rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[1, 2].map((i) => <div key={i} className="border border-line rounded-[6px] p-5 h-28 bg-paperdim/40"></div>)}
        </div>
      </div>
    );
  }

  const isAgentMode = profile.current_mode === "agent";
  const rating = profile.rating_count ? (profile.rating_sum / profile.rating_count).toFixed(1) : "—";

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Avatar tag={initials(profile.display_name)} size={44} src={profile.avatar_url} />
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-ink">
              {profile.display_name}'s dashboard
              <span className="ml-2.5 align-middle text-[11px] font-mono font-normal text-inksoft border border-line rounded-full px-2 py-0.5">
                {isAgentMode ? "Agent view" : "Client view"}
              </span>
            </h1>
            <p className="text-[13px] text-inksoft font-mono">{profile.agent_code}</p>
          </div>
        </div>
        {!isAgentMode && (
          <PrimaryButton onClick={() => router.push("/post")}><IconPlus size={15} /> Post a Project</PrimaryButton>
        )}
      </div>

      {isAgentMode ? (
        <>
          {/* AGENT MODE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="border border-line rounded-[6px] bg-surface p-5">
              <IconStar size={16} className="text-inksoft mb-4" />
              <div className="font-display font-extrabold text-[22px] text-ink">{rating}</div>
              <div className="text-[12px] text-inksoft mt-1">Rating</div>
            </div>
            <div className="border border-line rounded-[6px] bg-surface p-5">
              <IconCheck size={16} className="text-inksoft mb-4" />
              <div className="font-display font-extrabold text-[22px] text-ink">{profile.completed_count}</div>
              <div className="text-[12px] text-inksoft mt-1">Projects Completed</div>
            </div>
            <div className="border border-line rounded-[6px] bg-surface p-5">
              <IconBriefcase size={16} className="text-inksoft mb-4" />
              <div className="font-display font-extrabold text-[22px] text-ink">{myDeals.length}</div>
              <div className="text-[12px] text-inksoft mt-1">Total Deals</div>
            </div>
          </div>

          <h2 className="font-display font-bold text-[17px] text-ink mb-4">My Deals</h2>
          {myDeals.length === 0 ? (
            <p className="text-[14px] text-inksoft mb-10">No deals yet — offer to help on a project to get started.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {myDeals.map((d) => (
                <a key={d.id} href={`/projects/${d.projects?.id}`} className="border border-line rounded-[6px] bg-surface p-5 block hover:border-accent transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={d.status === "completed" ? "completed" : "in_progress"} />
                  </div>
                  <h3 className="font-display font-bold text-[15px] text-ink mb-2">{d.projects?.title}</h3>
                  <div className="text-[13px] font-mono text-accent">{money(d.payout)} <span className="text-inksoft">payout</span></div>
                </a>
              ))}
            </div>
          )}

          <h2 className="font-display font-bold text-[17px] text-ink mb-4">My Portfolio</h2>
          {portfolio.length === 0 ? (
            <p className="text-[14px] text-inksoft">
              No portfolio pieces yet. <a href="/profile" className="text-accent underline">Add some on your profile</a>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {portfolio.map((item) => {
                const imgUrl = item.image_path ? supabase.storage.from("project-files").getPublicUrl(item.image_path).data.publicUrl : null;
                return (
                  <div key={item.id} className="border border-line rounded-[6px] bg-surface overflow-hidden">
                    {imgUrl && <img src={imgUrl} alt={item.title} className="w-full h-32 object-cover" />}
                    <div className="p-4">
                      <h3 className="font-display font-semibold text-[14px] text-ink">{item.title}</h3>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* CLIENT MODE */}
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
                  <div className="flex items-center gap-2 mb-3">
                    <Pill>{p.category}</Pill>
                    <StatusBadge status={p.status} />
                  </div>
                  <h3 className="font-display font-bold text-[15px] text-ink mb-2">{p.title}</h3>
                  <div className="text-[13px] font-mono text-accent">{money(p.budget)}</div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}