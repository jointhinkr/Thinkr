"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TopBar() {
  const [initial, setInitial] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .single();
      const name = data?.display_name || data?.username || "?";
      setInitial(name.charAt(0).toUpperCase());
    });
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center justify-between w-full max-w-[560px] h-[52px] px-4 glass"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <Link
          href="/flux"
          className="font-display italic text-[22px] leading-none"
          style={{ color: "var(--flame)", fontWeight: 600 }}
        >
          Thinkr
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/echo"
            aria-label="Messages"
            className="w-8 h-8 rounded-full grid place-items-center transition-transform active:scale-90"
            style={{ color: "var(--ink-60)" }}
          >
            <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.5 11.4a7.5 7.5 0 0 1-10.6 6.8L4 20l1.4-3.7A7.5 7.5 0 1 1 20.5 11.4Z" />
              <path d="M8.5 10.5h7M8.5 13.5h4" />
            </svg>
          </Link>
          <Link
            href="/you"
            aria-label="Your profile"
            className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold transition-transform active:scale-90"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--amber))", boxShadow: "var(--shadow-sm)" }}
          >
            {initial || (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
              </svg>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
