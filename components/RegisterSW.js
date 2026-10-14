"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    // Only on the real site, so it never gets in the way while you are building
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}