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

  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [draftSpecialty, setDraftSpecialty] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [portfolio, setPortfolio] = useState([]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLink, setPLink] = useState("");
  const [pFile, setPFile] = useState(null);
  const [savingPortfolio, setSavingPortfolio] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  useEffect(() => {
    if (user === null) router.push("/login");
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      setProfile(data);
      setDraftSkills(data?.skills || []);
      setDraftBio(data?.bio || "");
      setDraftSpecialty(data?.specialty || "");
    });
    supabase.from("portfolio_items").select("*").eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPortfolio(data || []));
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

  const saveBio = async () => {
    await supabase.from("profiles").update({ bio: draftBio, specialty: draftSpecialty }).eq("id", user.id);
    setProfile((p) => ({ ...p, bio: draftBio, specialty: draftSpecialty }));
    setEditingBio(false);
  };

  async function uploadAvatar(file) {
    if (!file) return;
    setUploadingAvatar(true);
    const path = `avatars/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("project-files").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      setProfile((p) => ({ ...p, avatar_url: data.publicUrl }));
    }
    setUploadingAvatar(false);
  }

  async function addPortfolioItem(e) {
    e.preventDefault();
    if (!pTitle.trim()) return;
    setSavingPortfolio(true);
    let image_path = null;
    if (pFile) {
      const path = `portfolio/${user.id}/${Date.now()}-${pFile.name}`;
      const { error } = await supabase.storage.from("project-files").upload(path, pFile);
      if (!error) image_path = path;
    }
    const { data, error } = await supabase.from("portfolio_items").insert({
      profile_id: user.id,
      title: pTitle.trim(),
      description: pDesc.trim(),
      link: pLink.trim(),
      image_path,
    }).select().single();
    if (!error) {
      setPortfolio((cur) => [data, ...cur]);
      setPTitle(""); setPDesc(""); setPLink(""); setPFile(null);
      setShowPortfolioForm(false);
    }
    setSavingPortfolio(false);
  }

  async function deletePortfolioItem(item) {
    await supabase.from("portfolio_items").delete().eq("id", item.id);
    setPortfolio((cur) => cur.filter((p) => p.id !== item.id));
  }

  if (!user || !profile) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;

  const rating = profile.rating_count ? (profile.rating_sum / profile.rating_count).toFixed(1) : "—";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-start gap-8 border-b border-line pb-10 mb-10">
        <div className="relative shrink-0">
          <Avatar tag={initials(profile.display_name)} size={92} src={profile.avatar_url} />
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-[13px] cursor-pointer border-2 border-paper">
            {uploadingAvatar ? "…" : "📷"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
          </label>
        </div>

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

          {/* Bio + specialty */}
          {editingBio ? (
            <div className="mt-6 space-y-3">
              <div>
                <label className="text-[12px] text-inksoft mb-1 block">Specialty</label>
                <input value={draftSpecialty} onChange={(e) => setDraftSpecialty(e.target.value)}
                  placeholder="e.g. 3D Rendering & Visualization"
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
              </div>
              <div>
                <label className="text-[12px] text-inksoft mb-1 block">Bio</label>
                <textarea value={draftBio} onChange={(e) => setDraftBio(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-[4px] border border-line text-[13.5px] text-ink resize-none" />
              </div>
              <div className="flex gap-2">
                <PrimaryButton onClick={saveBio}>Save</PrimaryButton>
                <SecondaryButton onClick={() => setEditingBio(false)}>Cancel</SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              {profile.specialty && <p className="text-[13.5px] text-accent font-medium mb-1">{profile.specialty}</p>}
              <p className="text-[13.5px] text-inksoft leading-relaxed">{profile.bio || "No bio added yet."}</p>
              <button onClick={() => { setDraftBio(profile.bio || ""); setDraftSpecialty(profile.specialty || ""); setEditingBio(true); }}
                className="text-[12.5px] text-ink underline mt-2">
                Edit bio &amp; specialty
              </button>
            </div>
          )}

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

      {/* Portfolio */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-[18px] text-ink">Portfolio</h2>
          <SecondaryButton onClick={() => setShowPortfolioForm((v) => !v)}>
            {showPortfolioForm ? "Cancel" : "+ Add piece"}
          </SecondaryButton>
        </div>

        {showPortfolioForm && (
          <form onSubmit={addPortfolioItem} className="border border-line rounded-[6px] bg-surface p-5 mb-6 space-y-3">
            <div>
              <label className="text-[12px] text-inksoft mb-1 block">Title</label>
              <input required value={pTitle} onChange={(e) => setPTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
            </div>
            <div>
              <label className="text-[12px] text-inksoft mb-1 block">Description</label>
              <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-[4px] border border-line text-[13.5px] text-ink resize-none" />
            </div>
            <div>
              <label className="text-[12px] text-inksoft mb-1 block">Link (optional)</label>
              <input value={pLink} onChange={(e) => setPLink(e.target.value)} placeholder="https://…"
                className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
            </div>
            <div>
              <label className="text-[12px] text-inksoft mb-1 block">Image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setPFile(e.target.files?.[0] || null)}
                className="w-full text-[13px] text-ink" />
            </div>
            <PrimaryButton type="submit" disabled={savingPortfolio}>
              {savingPortfolio ? "Saving…" : "Add to portfolio"}
            </PrimaryButton>
          </form>
        )}

        {portfolio.length === 0 && !showPortfolioForm && (
          <p className="text-[13.5px] text-inksoft">No portfolio pieces added yet.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio.map((item) => {
            const imgUrl = item.image_path ? supabase.storage.from("project-files").getPublicUrl(item.image_path).data.publicUrl : null;
            return (
              <div key={item.id} className="border border-line rounded-[6px] bg-surface overflow-hidden">
                {imgUrl && <img src={imgUrl} alt={item.title} className="w-full h-36 object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-[14.5px] text-ink">{item.title}</h3>
                    <button onClick={() => deletePortfolioItem(item)} className="text-inksoft hover:text-red-600 text-[12px] shrink-0">✕</button>
                  </div>
                  {item.description && <p className="text-[12.5px] text-inksoft mt-1.5 leading-relaxed">{item.description}</p>}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent underline mt-2 inline-block">
                      View link
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}