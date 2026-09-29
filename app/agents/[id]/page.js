"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { Avatar, initials, IconStar, IconArrowLeft, PrimaryButton } from "../../../components/ui";

export default function AgentPublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [agent, setAgent] = useState(undefined);
  const [portfolio, setPortfolio] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [user, setUser] = useState(undefined);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", id).single()
      .then(({ data }) => setAgent(data || null));
    supabase.from("portfolio_items").select("*").eq("profile_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setPortfolio(data || []));
    supabase.from("ratings").select("*, rater:profiles!ratings_rater_id_fkey(display_name)").eq("ratee_id", id)
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setRatings(data || []));
  }, [id]);

  async function messageAgent() {
    if (!user) { router.push("/login"); return; }
    if (user.id === id) return;
    setStarting(true);

    // check for ANY existing conversation with this person, project or not, either role
    const { data: existing } = await supabase
      .from("threads")
      .select("id")
      .or(
        `and(owner_id.eq.${user.id},helper_id.eq.${id}),and(owner_id.eq.${id},helper_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data } = await supabase
      .from("threads")
      .insert({ project_id: null, owner_id: user.id, helper_id: id })
      .select()
      .single();
    setStarting(false);
    if (data) router.push(`/messages/${data.id}`);
  }

  if (agent === undefined) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Loading…</div>;
  if (agent === null) return <div className="max-w-3xl mx-auto px-5 py-16 text-inksoft">Agent not found.</div>;

  const rating = agent.rating_count ? (agent.rating_sum / agent.rating_count).toFixed(1) : null;
  const isSelf = user && user.id === id;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <button onClick={() => router.push("/agents")} className="inline-flex items-center gap-2 text-[13.5px] text-inksoft hover:text-ink mb-8">
        <IconArrowLeft size={15} /> Back to agents
      </button>

      <div className="flex flex-col md:flex-row md:items-start gap-8 border-b border-line pb-10 mb-10">
        <Avatar tag={initials(agent.display_name)} size={92} src={agent.avatar_url} />
        <div className="flex-1">
          <h1 className="font-display font-extrabold text-[26px] text-ink">{agent.display_name}</h1>
          {agent.specialty && <p className="text-[14px] text-accent font-medium mt-1">{agent.specialty}</p>}

          <div className="flex flex-wrap gap-8 mt-5">
            <div>
              <div className="flex items-center gap-1.5 text-[18px] font-display font-bold text-ink">
                <IconStar size={15} className="text-accent" /> {rating || "New"}
              </div>
              <div className="text-[11.5px] text-inksoft mt-0.5">Rating ({agent.rating_count || 0})</div>
            </div>
            <div>
              <div className="text-[18px] font-display font-bold text-ink">{agent.completed_count}</div>
              <div className="text-[11.5px] text-inksoft mt-0.5">Completed projects</div>
            </div>
          </div>

          {agent.bio && <p className="text-[13.5px] text-inksoft leading-relaxed mt-5 max-w-xl">{agent.bio}</p>}

          <div className="flex flex-wrap gap-1.5 mt-5">
            {(agent.skills || []).map((s) => (
              <span key={s} className="text-[12px] text-ink bg-paperdim px-2.5 py-1 rounded-[3px] border border-line">{s}</span>
            ))}
          </div>
        </div>

        {!isSelf && (
          <PrimaryButton onClick={messageAgent} disabled={starting}>
            {starting ? "Starting…" : "💬 Message"}
          </PrimaryButton>
        )}
      </div>

      <div className="mb-10">
        <h2 className="font-display font-bold text-[18px] text-ink mb-5">Portfolio</h2>
        {portfolio.length === 0 ? (
          <p className="text-[13.5px] text-inksoft">No portfolio pieces added yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolio.map((item) => {
              const imgUrl = item.image_path ? supabase.storage.from("project-files").getPublicUrl(item.image_path).data.publicUrl : null;
              return (
                <div key={item.id} className="border border-line rounded-[6px] bg-surface overflow-hidden">
                  {imgUrl && <img src={imgUrl} alt={item.title} className="w-full h-36 object-cover" />}
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-[14.5px] text-ink">{item.title}</h3>
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
        )}
      </div>

      <div>
        <h2 className="font-display font-bold text-[18px] text-ink mb-5">Reviews</h2>
        {ratings.length === 0 ? (
          <p className="text-[13.5px] text-inksoft">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {ratings.map((r) => (
              <div key={r.id} className="border border-line rounded-[6px] bg-surface p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} size={13} className={i < r.stars ? "text-accent" : "text-line"} />
                    ))}
                  </div>
                  <span className="text-[12.5px] text-inksoft">by {r.rater?.display_name || "Client"}</span>
                </div>
                {r.comment && <p className="text-[13px] text-ink">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}