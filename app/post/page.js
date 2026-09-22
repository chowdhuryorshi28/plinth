"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PrimaryButton, CATEGORIES } from "../../components/ui";

export default function PostProjectPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined); // undefined = checking, null = not logged in
  const [form, setForm] = useState({
    title: "", category: "3D Rendering", description: "",
    tasks: "", software: "", deadline: "", hours: "", budget: "",
  });
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setPosting(true);
    setError("");
    const requirements = form.tasks.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    const software = form.software.split(",").map((s) => s.trim()).filter(Boolean);

    const { data, error } = await supabase.from("projects").insert({
      owner_id: user.id,
      title: form.title || "Untitled project",
      category: form.category,
      description: form.description,
      requirements, software,
      deadline: form.deadline || "TBD",
      workload: form.hours ? form.hours + " hrs" : "TBD",
      budget: Number(form.budget) || 0,
    }).select().single();

    setPosting(false);
    if (error) { setError(error.message); return; }
    router.push(`/projects/${data.id}`);
  };

  if (user === undefined) {
    return <div className="max-w-2xl mx-auto px-5 py-16 text-center text-inksoft">Checking your login…</div>;
  }
  if (user === null) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <p className="text-[14.5px] text-inksoft mb-5">You need to be logged in to post a project.</p>
        <PrimaryButton onClick={() => router.push("/login")}>Log in</PrimaryButton>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-10">
      <h1 className="font-display font-extrabold text-[26px] text-ink mb-2">Post a project</h1>
      <p className="text-[14px] text-inksoft mb-8">Tell agents what you need.</p>

      <form onSubmit={submit} className="border border-line rounded-[6px] bg-surface p-6 md:p-8 space-y-5">
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Project title</label>
          <input required value={form.title} onChange={set("title")} placeholder="e.g. Need help with exterior rendering"
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Category</label>
          <select value={form.category} onChange={set("category")}
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink">
            {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Description</label>
          <textarea required value={form.description} onChange={set("description")} rows={4}
            className="w-full px-4 py-3 rounded-[4px] border border-line text-[14px] text-ink resize-none" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Specific tasks (comma or newline separated)</label>
          <textarea value={form.tasks} onChange={set("tasks")} rows={3}
            className="w-full px-4 py-3 rounded-[4px] border border-line text-[14px] text-ink resize-none" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Required software (comma separated)</label>
          <input value={form.software} onChange={set("software")} placeholder="e.g. SketchUp, D5 Render"
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-[12.5px] text-inksoft mb-1.5 block">Deadline</label>
            <input value={form.deadline} onChange={set("deadline")} placeholder="e.g. 28 Sep 2026"
              className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
          </div>
          <div>
            <label className="text-[12.5px] text-inksoft mb-1.5 block">Estimated hours</label>
            <input value={form.hours} onChange={set("hours")} placeholder="e.g. 5–6"
              className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
          </div>
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Budget (৳)</label>
          <input type="number" value={form.budget} onChange={set("budget")} placeholder="e.g. 2500"
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={posting} className="w-full">
          {posting ? "Posting…" : "Post Project"}
        </PrimaryButton>
      </form>
    </div>
  );
}
