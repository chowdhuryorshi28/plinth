"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Avatar, Pill, initials, PrimaryButton, SecondaryButton, SKILL_OPTIONS, IconStar, IconDot } from "../../components/ui";

const BUCKET = "project-files";
const MAX_IMAGES = 5;
const MAX_MB = 5;

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draftSkills, setDraftSkills] = useState([]);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [draftSpecialty, setDraftSpecialty] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [portfolio, setPortfolio] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLink, setPLink] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [pDate, setPDate] = useState("");
  const [pExisting, setPExisting] = useState([]);
  const [pNewFiles, setPNewFiles] = useState([]);
  const [pError, setPError] = useState("");
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
      setDraftName(data?.display_name || "");
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
    await supabase.from("profiles").update({ bio: draftBio.trim(), specialty: draftSpecialty.trim() }).eq("id", user.id);
    setProfile((p) => ({ ...p, bio: draftBio.trim(), specialty: draftSpecialty.trim() }));
    setEditingBio(false);
  };

  async function saveName() {
    const name = draftName.trim().replace(/\s+/g, " ");
    if (name.length < 2) { setNameError("Name must be at least 2 characters."); return; }
    if (name.length > 50) { setNameError("Name must be 50 characters or fewer."); return; }
    setSavingName(true);
    setNameError("");
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setSavingName(false);
    if (error) { setNameError("Could not save. Please try again."); return; }
    setProfile((p) => ({ ...p, display_name: name }));
    setEditingName(false);
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_MB * 1024 * 1024) return;
    setUploadingAvatar(true);
    const path = `avatars/${user.id}/${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      setProfile((p) => ({ ...p, avatar_url: data.publicUrl }));
    }
    setUploadingAvatar(false);
  }

  function itemPaths(item) {
    if (item.image_paths && item.image_paths.length) return item.image_paths;
    return item.image_path ? [item.image_path] : [];
  }

  function resetForm() {
    setEditingId(null);
    setPTitle(""); setPDesc(""); setPLink(""); setPCategory(""); setPDate("");
    setPExisting([]); setPNewFiles([]); setPError("");
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(item) {
    resetForm();
    setEditingId(item.id);
    setPTitle(item.title || "");
    setPDesc(item.description || "");
    setPLink(item.link || "");
    setPCategory(item.category || "");
    setPDate(item.project_date || "");
    setPExisting(itemPaths(item));
    setShowForm(true);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function pickFiles(fileList) {
    const files = Array.from(fileList || []);
    let message = "";
    const room = MAX_IMAGES - pExisting.length - pNewFiles.length;
    const accepted = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) { message = "Only image files are allowed."; continue; }
      if (f.size > MAX_MB * 1024 * 1024) { message = "Each image must be under " + MAX_MB + " MB."; continue; }
      if (accepted.length >= room) { message = "You can add up to " + MAX_IMAGES + " images."; break; }
      accepted.push(f);
    }
    setPError(message);
    if (accepted.length) setPNewFiles((cur) => [...cur, ...accepted]);
  }

  async function savePortfolioItem(e) {
    e.preventDefault();
    if (savingPortfolio) return;
    const title = pTitle.trim();
    if (!title) return;
    let link = pLink.trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;

    setSavingPortfolio(true);
    setPError("");

    const uploaded = [];
    for (const f of pNewFiles) {
      const path = `portfolio/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName(f.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f);
      if (error) {
        setPError("Could not upload " + f.name + ". Please try again.");
        setSavingPortfolio(false);
        return;
      }
      uploaded.push(path);
    }

    const paths = [...pExisting, ...uploaded];
    const row = {
      title,
      description: pDesc.trim(),
      link,
      category: pCategory.trim(),
      project_date: pDate || null,
      image_path: paths[0] || null,
      image_paths: paths,
    };

    if (editingId) {
      const before = portfolio.find((p) => p.id === editingId);
      const { data, error } = await supabase.from("portfolio_items")
        .update(row).eq("id", editingId).eq("profile_id", user.id).select().single();
      if (error || !data) {
        setPError("Could not save changes. Please try again.");
        setSavingPortfolio(false);
        return;
      }
      setPortfolio((cur) => cur.map((p) => (p.id === editingId ? data : p)));
      const removed = before ? itemPaths(before).filter((p) => !paths.includes(p)) : [];
      if (removed.length) await supabase.storage.from(BUCKET).remove(removed);
    } else {
      const { data, error } = await supabase.from("portfolio_items")
        .insert({ ...row, profile_id: user.id }).select().single();
      if (error || !data) {
        setPError("Could not save. Please try again.");
        setSavingPortfolio(false);
        return;
      }
      setPortfolio((cur) => [data, ...cur]);
    }
    setSavingPortfolio(false);
    closeForm();
  }

  async function deletePortfolioItem(item) {
    if (!window.confirm("Delete \"" + item.title + "\" from your portfolio?")) return;
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id).eq("profile_id", user.id);
    if (error) return;
    setPortfolio((cur) => cur.filter((p) => p.id !== item.id));
    if (editingId === item.id) closeForm();
    const paths = itemPaths(item);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  }

  const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  if (!user || !profile) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading{"\u2026"}</div>;

  const rating = profile.rating_count ? (profile.rating_sum / profile.rating_count).toFixed(1) : "\u2014";
  const imageCount = pExisting.length + pNewFiles.length;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-start gap-8 border-b border-line pb-10 mb-10">
        <div className="relative shrink-0">
          <Avatar tag={initials(profile.display_name)} size={92} src={profile.avatar_url} />
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-[13px] cursor-pointer border-2 border-paper">
            {uploadingAvatar ? "\u2026" : "\uD83D\uDCF7"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-[12px] text-inksoft block">Display name</label>
              <input
                id="displayName"
                name="displayName"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.slice(0, 50))}
                className="w-full max-w-sm h-10 px-3 rounded-[4px] border border-line text-[14px] text-ink"
              />
              {nameError && <p className="text-[12.5px] text-red-500">{nameError}</p>}
              <div className="flex gap-2">
                <PrimaryButton onClick={saveName} disabled={savingName}>{savingName ? "Saving\u2026" : "Save name"}</PrimaryButton>
                <SecondaryButton onClick={() => { setEditingName(false); setDraftName(profile.display_name || ""); setNameError(""); }}>Cancel</SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display font-extrabold text-[26px] text-ink break-words">{profile.display_name}</h1>
              <button
                type="button"
                onClick={() => { setDraftName(profile.display_name || ""); setEditingName(true); }}
                className="text-[12.5px] text-ink underline"
              >
                Edit name
              </button>
              <button onClick={toggleAvailable}>
                <Pill tone={profile.available_for_work ? "accent" : "default"}>
                  <IconDot size={10} /> {profile.available_for_work ? "Available for work" : "Not available"}
                </Pill>
              </button>
            </div>
          )}
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

          {editingBio ? (
            <div className="mt-6 space-y-3">
              <div>
                <label htmlFor="specialty" className="text-[12px] text-inksoft mb-1 block">Specialty</label>
                <input id="specialty" name="specialty" value={draftSpecialty} onChange={(e) => setDraftSpecialty(e.target.value.slice(0, 100))}
                  placeholder="e.g. 3D Rendering & Visualization"
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
              </div>
              <div>
                <label htmlFor="bio" className="text-[12px] text-inksoft mb-1 block">Bio</label>
                <textarea id="bio" name="bio" value={draftBio} onChange={(e) => setDraftBio(e.target.value.slice(0, 600))} rows={4}
                  className="w-full px-3 py-2 rounded-[4px] border border-line text-[13.5px] text-ink resize-none" />
                <p className="text-[11px] text-inksoft mt-1">{draftBio.length}/600</p>
              </div>
              <div className="flex gap-2">
                <PrimaryButton onClick={saveBio}>Save</PrimaryButton>
                <SecondaryButton onClick={() => setEditingBio(false)}>Cancel</SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              {profile.specialty && <p className="text-[13.5px] text-accent font-medium mb-1">{profile.specialty}</p>}
              <p className="text-[13.5px] text-inksoft leading-relaxed break-words">{profile.bio || "No bio added yet."}</p>
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

      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-[18px] text-ink">Portfolio</h2>
          <SecondaryButton onClick={() => (showForm ? closeForm() : openNewForm())}>
            {showForm ? "Cancel" : "+ Add piece"}
          </SecondaryButton>
        </div>

        {showForm && (
          <form onSubmit={savePortfolioItem} className="border border-line rounded-[6px] bg-surface p-5 mb-6 space-y-3">
            <div className="text-[13.5px] text-ink font-medium">{editingId ? "Edit piece" : "New piece"}</div>
            <div>
              <label htmlFor="pTitle" className="text-[12px] text-inksoft mb-1 block">Title</label>
              <input id="pTitle" name="pTitle" required value={pTitle} onChange={(e) => setPTitle(e.target.value.slice(0, 80))}
                className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pCategory" className="text-[12px] text-inksoft mb-1 block">Category (optional)</label>
                <input id="pCategory" name="pCategory" list="portfolioCategories" value={pCategory} onChange={(e) => setPCategory(e.target.value.slice(0, 40))}
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
                <datalist id="portfolioCategories">
                  {SKILL_OPTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="pDate" className="text-[12px] text-inksoft mb-1 block">Project date (optional)</label>
                <input id="pDate" name="pDate" type="date" value={pDate} onChange={(e) => setPDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
              </div>
            </div>
            <div>
              <label htmlFor="pDesc" className="text-[12px] text-inksoft mb-1 block">Description</label>
              <textarea id="pDesc" name="pDesc" value={pDesc} onChange={(e) => setPDesc(e.target.value.slice(0, 600))} rows={3}
                className="w-full px-3 py-2 rounded-[4px] border border-line text-[13.5px] text-ink resize-none" />
              <p className="text-[11px] text-inksoft mt-1">{pDesc.length}/600</p>
            </div>
            <div>
              <label htmlFor="pLink" className="text-[12px] text-inksoft mb-1 block">Link (optional)</label>
              <input id="pLink" name="pLink" value={pLink} onChange={(e) => setPLink(e.target.value)} placeholder="https://example.com"
                className="w-full h-10 px-3 rounded-[4px] border border-line text-[13.5px] text-ink" />
            </div>

            <div>
              <div className="text-[12px] text-inksoft mb-1.5">Images ({imageCount}/{MAX_IMAGES}). The first one is the cover.</div>
              {(pExisting.length > 0 || pNewFiles.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pExisting.map((p, i) => (
                    <div key={p} className="relative w-20 h-20 border border-line rounded-[4px] overflow-hidden">
                      <img src={publicUrl(p)} alt="" className="w-full h-full object-cover" />
                      {i === 0 && <span className="absolute left-0 bottom-0 bg-ink text-paper text-[9px] px-1">Cover</span>}
                      <button type="button" aria-label="Remove image"
                        onClick={() => setPExisting((cur) => cur.filter((x) => x !== p))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-ink text-paper text-[11px] leading-none">{"\u2715"}</button>
                    </div>
                  ))}
                  {pNewFiles.map((f, i) => (
                    <div key={f.name + i} className="relative w-20 h-20 border border-dashed border-line rounded-[4px] p-1 flex items-center justify-center">
                      <span className="text-[10px] text-inksoft break-all text-center line-clamp-4">{f.name}</span>
                      <button type="button" aria-label="Remove image"
                        onClick={() => setPNewFiles((cur) => cur.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-ink text-paper text-[11px] leading-none">{"\u2715"}</button>
                    </div>
                  ))}
                </div>
              )}
              {imageCount < MAX_IMAGES && (
                <input type="file" accept="image/*" multiple
                  onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
                  className="w-full text-[13px] text-ink" />
              )}
            </div>

            {pError && <p className="text-[12.5px] text-red-500">{pError}</p>}

            <div className="flex gap-2">
              <PrimaryButton type="submit" disabled={savingPortfolio}>
                {savingPortfolio ? "Saving\u2026" : editingId ? "Save changes" : "Add to portfolio"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={closeForm}>Cancel</SecondaryButton>
            </div>
          </form>
        )}

        {portfolio.length === 0 && !showForm && (
          <p className="text-[13.5px] text-inksoft">No portfolio pieces added yet.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio.map((item) => {
            const paths = itemPaths(item);
            const cover = paths[0] ? publicUrl(paths[0]) : null;
            return (
              <div key={item.id} className="border border-line rounded-[6px] bg-surface overflow-hidden">
                {cover && (
                  <div className="relative">
                    <img src={cover} alt={item.title} className="w-full h-36 object-cover" />
                    {paths.length > 1 && (
                      <span className="absolute right-2 bottom-2 bg-ink/80 text-paper text-[10.5px] px-1.5 py-0.5 rounded-[3px]">
                        {paths.length} images
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-display font-semibold text-[14.5px] text-ink break-words">{item.title}</h3>
                  {(item.category || item.project_date) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {item.category && <span className="text-[10.5px] text-ink bg-paperdim px-2 py-0.5 rounded-[3px] border border-line">{item.category}</span>}
                      {item.project_date && (
                        <span className="text-[10.5px] text-inksoft font-mono">
                          {new Date(item.project_date + "T00:00:00").toLocaleDateString([], { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  )}
                  {item.description && <p className="text-[12.5px] text-inksoft mt-1.5 leading-relaxed break-words">{item.description}</p>}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent underline mt-2 inline-block">
                      View link
                    </a>
                  )}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
                    <button type="button" onClick={() => openEditForm(item)} className="text-[12px] text-ink underline">Edit</button>
                    <button type="button" onClick={() => deletePortfolioItem(item)} className="text-[12px] text-inksoft hover:text-red-600">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}