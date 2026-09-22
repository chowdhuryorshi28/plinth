"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PrimaryButton, SKILL_OPTIONS, makeAgentCode } from "../../components/ui";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleSkill = (s) => setSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1: create the login (Supabase Auth gives this person a
    // unique, permanent user id the moment this succeeds).
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    const user = data.user;
    if (!user) {
      setError("Check your inbox to confirm your email, then log in.");
      setLoading(false);
      return;
    }

    // Step 2: generate a friendly, unique Agent Code, checking
    // it isn't already taken (extremely unlikely, but we check anyway).
    let agentCode = null;
    for (let i = 0; i < 5; i++) {
      const candidate = makeAgentCode();
      const { data: clash } = await supabase.from("profiles").select("id").eq("agent_code", candidate).limit(1);
      if (!clash || clash.length === 0) { agentCode = candidate; break; }
    }
    if (!agentCode) agentCode = makeAgentCode() + Date.now().toString(36).slice(-3).toUpperCase();

    // Step 3: save the profile row linked to that unique user id.
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      agent_code: agentCode,
      display_name: displayName || "Unnamed Agent",
      skills,
    });
    if (profileError) { setError(profileError.message); setLoading(false); return; }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <h1 className="font-display font-extrabold text-[26px] text-ink mb-2">Create your Agent</h1>
      <p className="text-[14px] text-inksoft mb-8">You'll get a unique Agent Code, saved forever with this login.</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Password</label>
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Display name</label>
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Priyo Rahman"
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-2 block">Skills (optional)</label>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => toggleSkill(s)}
                className={`text-[12px] px-2.5 py-1 rounded-[3px] border transition-colors ${skills.includes(s) ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:border-ink hover:text-ink"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? "Creating…" : "Create my Agent"}
        </PrimaryButton>
      </form>
    </div>
  );
}
