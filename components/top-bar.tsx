"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

export default function TopBar() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", user.id)
        .single();
      setName(data?.display_name || data?.username || "?");
      setAvatar(data?.avatar_url ?? null);
    });
    function onAvatar(e: Event) { setAvatar((e as CustomEvent).detail ?? null); }
    window.addEventListener("thinkr:avatar", onAvatar);
    return () => window.removeEventListener("thinkr:avatar", onAvatar);
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
          <Link href="/you" aria-label="Your profile" className="transition-transform active:scale-90">
            <Avatar name={name} src={avatar} size={32} className="shadow-sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
