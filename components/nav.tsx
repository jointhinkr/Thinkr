"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/spark", label: "Spark" },
  { href: "/twin", label: "Twin" },
  { href: "/circles", label: "Circles" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-50 border-b border-black/8"
      style={{ background: "var(--cream)" }}
    >
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/feed"
          className="text-xl"
          style={{ fontFamily: "'Fraunces', serif", color: "var(--flame)" }}
        >
          Thinkr
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "11px",
                  background: active ? "var(--flame)" : "transparent",
                  color: active ? "#fff" : "inherit",
                  opacity: active ? 1 : 0.55,
                }}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="ml-3 px-3 py-1.5 rounded-lg text-xs opacity-40 hover:opacity-70 transition-opacity"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            out
          </button>
        </nav>
      </div>
    </header>
  );
}
