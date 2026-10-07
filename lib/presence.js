"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "./supabase/client";

const PresenceContext = createContext(new Set());

export function PresenceProvider({ children }) {
  const [onlineIds, setOnlineIds] = useState(new Set());

  useEffect(() => {
    const supabase = createClient();
    let channel;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user || cancelled) return;

      channel = supabase.channel("online-users", {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          setOnlineIds(new Set(Object.keys(state)));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>;
}

export function useOnline(userId) {
  const onlineIds = useContext(PresenceContext);
  return userId ? onlineIds.has(userId) : false;
}

export function useOnlineSet() {
  return useContext(PresenceContext);
}