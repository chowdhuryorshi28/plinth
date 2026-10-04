// Shared logic for starting or reopening a conversation between two people.
// Used everywhere a "Chat" / "Offer to Help" / "Message" button exists,
// so there's only ever ONE thread per pair of people — never duplicates.

export async function startOrOpenThread(supabase, { currentUserId, otherUserId, project }) {
  // 1. Look for ANY existing thread between these two people, regardless of
  //    which one is stored as owner_id vs helper_id.
  const { data: existing } = await supabase
    .from("threads")
    .select("id")
    .or(
      `and(owner_id.eq.${currentUserId},helper_id.eq.${otherUserId}),and(owner_id.eq.${otherUserId},helper_id.eq.${currentUserId})`
    )
    .maybeSingle();

  let threadId = existing?.id;

  // 2. No existing conversation at all — create one.
  if (!threadId) {
    const { data: created, error } = await supabase
      .from("threads")
      .insert({
        owner_id: currentUserId,
        helper_id: otherUserId,
        project_id: project ? project.id : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    threadId = created.id;
  }

  // 3. If this message is about a specific project, drop a project-card
  //    message into the conversation (but only once per project, even if
  //    the person clicks the button again later).
  if (project) {
    const { data: existingCard } = await supabase
      .from("messages")
      .select("id")
      .eq("thread_id", threadId)
      .eq("project_id", project.id)
      .maybeSingle();

    if (!existingCard) {
      await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: currentUserId,
        project_id: project.id,
        content: null,
      });
    }

    // keep a "most recently discussed project" pointer on the thread,
    // used for the chat page's project-info sidebar
    await supabase.from("threads").update({ project_id: project.id }).eq("id", threadId);
  }

  return threadId;
}