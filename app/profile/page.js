"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Avatar, Pill, initials, PrimaryButton, SecondaryButton, SKILL_OPTIONS, IconStar, IconDot } from "../../components/ui";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draftSkills, setDraftSkills] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  useEffect(() => {
    if (user === null) router.push("/login");
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      setProfile(data);
      setDraftSkills(data?.skills || []);
    });
  }, [user]);

  const toggleSkill = (s) => setDraftSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const saveSkills = async () => {
    await supabase.from("profiles").update({ skills: draftSkills }).eq("id", user.id);
    setProfile((p) => ({ ...p, skills: draftSkills }));
    setEditing(false);
  };

  const toggleAvailable = async () => {
    const next = !profile.available_for_work;
    await supabase.from("profiles").update({ available_for_work: next }).eq("id", user.id);
    setProfile((p) => ({ ...p, available_for_work: next }));
  };

  if (!user || !profile) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;

  const rating = profile.rating_count ? (profile.rating_sum / profile.rating_count).toFixed(1) : "—";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-start gap-8 border-b border-line pb-10 mb-10">
        <Avatar tag={initials(profile.display_name)} size={92} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display font-extrabold text-[26px] text-ink">{profile.display_name}</h1>
            <button onClick={toggleAvailable}>
              <Pill tone={profile.available_for_work ? "accent" : "default"}>
                <IconDot size={10} /> {profile.available_for_work ? "Available for work" : "Not available"}
              </Pill>
            </button>
          </div>
          <p className="text-[13px] text-inksoft mt-1 font-mono">{profile.agent_code}</p>

          <div className="flex flex-wrap gap-8 mt-6">
            <div>
              <div className="flex items-center gap-1.5 text-[18px] font-display font-bold text-ink"><IconStar size={15} className="text-accent" />{rating}</div>
              <div className="text-[11.5px] text-inksoft mt-0.5">Rating</div>
            </div>
            <div>
              <div className="text-[18px] font-display font-bold text-ink">{profile.completed_count}</div>
              <div className="text-[11.5px] text-inksoft mt-0.5">Completed projects</div>
            </div>
          </div>

          {editing ? (
            <div className="mt-6">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SKILL_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleSkill(s)}
                    className={`text-[12px] px-2.5 py-1 rounded-[3px] border transition-colors ${draftSkills.includes(s) ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:border-ink hover:text-ink"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <PrimaryButton onClick={saveSkills}>Save skills</PrimaryButton>
                <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-6">
              {(profile.skills || []).length === 0 && <span className="text-[12.5px] text-inksoft">No skills added yet.</span>}
              {(profile.skills || []).map((s) => <span key={s} className="text-[12px] text-ink bg-paperdim px-2.5 py-1 rounded-[3px] border border-line">{s}</span>)}
            </div>
          )}
        </div>
        <SecondaryButton onClick={() => { setDraftSkills(profile.skills || []); setEditing(true); }}>Edit skills</SecondaryButton>
      </div>
    </div>
  );
}
