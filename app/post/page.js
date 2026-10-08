"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PrimaryButton, CATEGORIES } from "../../components/ui";
import { BD_DISTRICTS } from "../../lib/districts";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function digitsOnly(value, maxLen) {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

function formatDeadlineInput(value) {
  const d = digitsOnly(value, 8);
  if (d.length > 4) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length > 2) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

function validateDeadline(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return "Enter the deadline as DD/MM/YYYY.";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "That date doesn't exist.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return "The deadline can't be in the past.";
  return "";
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[12px] text-red-500 mt-1.5">{message}</p>;
}

const fieldClass = (err) =>
  `w-full h-11 px-4 rounded-[4px] border text-[14px] text-ink ${err ? "border-red-500" : "border-line"}`;
const areaClass = (err) =>
  `w-full px-4 py-3 rounded-[4px] border text-[14px] text-ink resize-none ${err ? "border-red-500" : "border-line"}`;

export default function PostProjectPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [form, setForm] = useState({
    title: "", category: "3D Rendering", description: "", tasks: "", software: "",
    location: "", deadline: "", hours: "", budgetMin: "", budgetMax: "", negotiable: "",
  });
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
  }, []);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((cur) => (cur[key] ? { ...cur, [key]: "" } : cur));
  };

  const addImages = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length === 0) return;

    let message = "";
    const valid = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) { message = "Only image files can be added."; continue; }
      if (file.size > MAX_IMAGE_BYTES) { message = "Each image must be under 8 MB."; continue; }
      valid.push(file);
    }
    const room = MAX_IMAGES - images.length;
    if (valid.length > room) message = "You can add up to " + MAX_IMAGES + " images.";
    const accepted = valid.slice(0, Math.max(room, 0)).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((cur) => [...cur, ...accepted]);
    setErrors((cur) => ({ ...cur, images: message }));
  };

  const removeImage = (index) => {
    setImages((cur) => {
      URL.revokeObjectURL(cur[index].url);
      return cur.filter((_, i) => i !== index);
    });
    setErrors((cur) => ({ ...cur, images: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = "Add a project title.";
    if (!form.description.trim()) next.description = "Describe what you need.";

    const district = BD_DISTRICTS.find((d) => d.toLowerCase() === form.location.trim().toLowerCase());
    if (!district) next.location = "Choose a district from the list.";

    const deadlineError = validateDeadline(form.deadline);
    if (deadlineError) next.deadline = deadlineError;

    if (!form.hours || Number(form.hours) < 1) next.hours = "Enter the estimated hours as a number.";

    const min = Number(form.budgetMin);
    const max = Number(form.budgetMax);
    if (!min) next.budgetMin = "Enter the minimum budget.";
    if (!max) next.budgetMax = "Enter the maximum budget.";
    else if (min && max < min) next.budgetMax = "Maximum must be at least the minimum.";

    if (!form.negotiable) next.negotiable = "Choose negotiable or non-negotiable.";

    setErrors(next);
    return { ok: Object.keys(next).length === 0, district, min, max };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!user || posting) return;
    setSubmitError("");

    const { ok, district, min, max } = validate();
    if (!ok) return;

    setPosting(true);
    const requirements = form.tasks.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    const software = form.software.split(",").map((s) => s.trim()).filter(Boolean);

    const { data, error } = await supabase.from("projects").insert({
      owner_id: user.id,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      requirements,
      software,
      location: district,
      deadline: form.deadline,
      workload: form.hours + " hrs",
      budget: max,
      budget_min: min,
      budget_max: max,
      budget_negotiable: form.negotiable === "negotiable",
    }).select().single();

    if (error) {
      setPosting(false);
      setSubmitError(error.message);
      return;
    }

    for (let i = 0; i < images.length; i++) {
      const file = images[i].file;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = data.id + "/" + Date.now() + "-" + i + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file);
      if (!uploadError) {
        await supabase.from("project_files").insert({
          project_id: data.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          uploaded_by: user.id,
        });
      }
    }

    setPosting(false);
    router.push("/projects/" + data.id);
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

      <form onSubmit={submit} noValidate className="border border-line rounded-[6px] bg-surface p-6 md:p-8 space-y-5">
        <div>
          <label htmlFor="title" className="text-[12.5px] text-inksoft mb-1.5 block">Project title</label>
          <input id="title" name="title" value={form.title} onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Need help with exterior rendering" aria-invalid={!!errors.title}
            className={fieldClass(errors.title)} />
          <FieldError message={errors.title} />
        </div>

        <div>
          <label htmlFor="category" className="text-[12.5px] text-inksoft mb-1.5 block">Category</label>
          <select id="category" name="category" value={form.category} onChange={(e) => update("category", e.target.value)}
            className={fieldClass(false)}>
            {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="text-[12.5px] text-inksoft mb-1.5 block">Description</label>
          <textarea id="description" name="description" value={form.description} rows={4}
            onChange={(e) => update("description", e.target.value)} aria-invalid={!!errors.description}
            className={areaClass(errors.description)} />
          <FieldError message={errors.description} />
        </div>

        <div>
          <label htmlFor="tasks" className="text-[12.5px] text-inksoft mb-1.5 block">Specific tasks (comma or newline separated)</label>
          <textarea id="tasks" name="tasks" value={form.tasks} rows={3}
            onChange={(e) => update("tasks", e.target.value)} className={areaClass(false)} />
        </div>

        <div>
          <label htmlFor="software" className="text-[12.5px] text-inksoft mb-1.5 block">Required software (comma separated)</label>
          <input id="software" name="software" value={form.software} onChange={(e) => update("software", e.target.value)}
            placeholder="e.g. SketchUp, D5 Render" className={fieldClass(false)} />
        </div>

        <div>
          <label htmlFor="location" className="text-[12.5px] text-inksoft mb-1.5 block">Project location (district)</label>
          <input id="location" name="location" list="bd-districts" autoComplete="off"
            value={form.location} onChange={(e) => update("location", e.target.value)}
            placeholder="Start typing a district, e.g. Dhaka" aria-invalid={!!errors.location}
            className={fieldClass(errors.location)} />
          <datalist id="bd-districts">
            {BD_DISTRICTS.map((d) => <option key={d} value={d} />)}
          </datalist>
          <FieldError message={errors.location} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="deadline" className="text-[12.5px] text-inksoft mb-1.5 block">Deadline</label>
            <input id="deadline" name="deadline" inputMode="numeric" autoComplete="off" maxLength={10}
              value={form.deadline} onChange={(e) => update("deadline", formatDeadlineInput(e.target.value))}
              placeholder="DD/MM/YYYY" aria-invalid={!!errors.deadline}
              className={fieldClass(errors.deadline)} />
            <FieldError message={errors.deadline} />
          </div>
          <div>
            <label htmlFor="hours" className="text-[12.5px] text-inksoft mb-1.5 block">Estimated hours</label>
            <input id="hours" name="hours" inputMode="numeric" autoComplete="off"
              value={form.hours} onChange={(e) => update("hours", digitsOnly(e.target.value, 4))}
              placeholder="e.g. 6" aria-invalid={!!errors.hours}
              className={fieldClass(errors.hours)} />
            <FieldError message={errors.hours} />
          </div>
        </div>

        <div>
          <div className="text-[12.5px] text-inksoft mb-1.5">Budget range (&#2547;)</div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <input id="budgetMin" name="budgetMin" inputMode="numeric" autoComplete="off" aria-label="Minimum budget"
                value={form.budgetMin} onChange={(e) => update("budgetMin", digitsOnly(e.target.value, 7))}
                placeholder="Min, e.g. 2000" aria-invalid={!!errors.budgetMin}
                className={fieldClass(errors.budgetMin)} />
              <FieldError message={errors.budgetMin} />
            </div>
            <div>
              <input id="budgetMax" name="budgetMax" inputMode="numeric" autoComplete="off" aria-label="Maximum budget"
                value={form.budgetMax} onChange={(e) => update("budgetMax", digitsOnly(e.target.value, 7))}
                placeholder="Max, e.g. 2500" aria-invalid={!!errors.budgetMax}
                className={fieldClass(errors.budgetMax)} />
              <FieldError message={errors.budgetMax} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="negotiable" className="text-[12.5px] text-inksoft mb-1.5 block">Is the budget negotiable?</label>
          <select id="negotiable" name="negotiable" value={form.negotiable}
            onChange={(e) => update("negotiable", e.target.value)} aria-invalid={!!errors.negotiable}
            className={fieldClass(errors.negotiable)}>
            <option value="">Select…</option>
            <option value="negotiable">Negotiable</option>
            <option value="non-negotiable">Non-negotiable</option>
          </select>
          <FieldError message={errors.negotiable} />
        </div>

        <div>
          <div className="text-[12.5px] text-inksoft mb-1.5">Project images (up to {MAX_IMAGES})</div>
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, i) => (
              <div key={img.url} className="relative aspect-[4/3] rounded-[6px] overflow-hidden border border-line">
                <img src={img.url} alt={"Project image " + (i + 1)} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} aria-label={"Remove image " + (i + 1)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-[12px] flex items-center justify-center">
                  ✕
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label htmlFor="project-images"
                className="aspect-[4/3] rounded-[6px] border border-dashed border-line flex flex-col items-center justify-center text-[12px] text-inksoft cursor-pointer hover:border-accent hover:text-ink">
                <span className="text-[20px] leading-none">+</span>
                <span className="mt-1">Add image</span>
              </label>
            )}
          </div>
          <input id="project-images" name="projectImages" type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
          <p className="text-[11.5px] text-inksoft mt-2">
            {images.length}/{MAX_IMAGES} added. Agents can swipe through them on your project page.
          </p>
          <FieldError message={errors.images} />
        </div>

        {submitError && <p className="text-[13px] text-red-500">{submitError}</p>}

        <PrimaryButton type="submit" disabled={posting} className="w-full">
          {posting ? "Posting…" : "Post Project"}
        </PrimaryButton>
      </form>
    </div>
  );
}