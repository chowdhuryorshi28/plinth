"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "../lib/supabase/client";

const TABS = [
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/disputes", label: "Disputes" },
];

export default function AdminTabs() {
  const supabase = createClient();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setOk(data === true));
  }, []);

  if (!ok) return null;

  return (
    <div className="border-b border-line">
      <div className="max-w-4xl mx-auto px-5 md:px-8 pt-6 pb-4 flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const active = pathname && pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`text-[13px] px-3.5 py-1.5 rounded-[4px] border ${active ? "bg-ink text-paper border-ink" : "border-line text-inksoft hover:text-ink hover:border-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}