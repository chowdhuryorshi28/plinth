"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PrimaryButton } from "../../components/ui";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <h1 className="font-display font-extrabold text-[26px] text-ink mb-2">Log in</h1>
      <p className="text-[14px] text-inksoft mb-8">Welcome back to your Agent account.</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        <div>
          <label className="text-[12.5px] text-inksoft mb-1.5 block">Password</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-[4px] border border-line text-[14px] text-ink" />
        </div>
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? "Logging in…" : "Log in"}
        </PrimaryButton>
      </form>
    </div>
  );
}
