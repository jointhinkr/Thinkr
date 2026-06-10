"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string; filled?: boolean };

function FluxIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 5 13h6l-1 9 8-12h-6z" />
    </svg>
  );
}
function SparkIcon({ className = "", filled = false }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 2.5c.6 5.2 1.7 6.4 6.9 7-5.2.6-6.3 1.8-6.9 7-.6-5.2-1.7-6.4-6.9-7 5.2-.6 6.3-1.8 6.9-7Z" />
    </svg>
  );
}
function TwinIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="12" r="5.4" />
      <circle cx="15" cy="12" r="5.4" />
    </svg>
  );
}
function CirclesIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS = [
  { href: "/flux", label: "Flux", Icon: FluxIcon },
  { href: "/spark", label: "Spark", Icon: SparkIcon },
  null,
  { href: "/twin", label: "Twin", Icon: TwinIcon },
  { href: "/circles", label: "Circles", Icon: CirclesIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none pb-[max(12px,env(safe-area-inset-bottom))]">
      <nav
        className="pointer-events-auto relative grid grid-cols-5 items-center gap-1 px-2.5 h-[62px] rounded-[26px] glass border w-[calc(100%-24px)] max-w-[460px]"
        style={{ borderColor: "var(--line-2)", boxShadow: "var(--shadow-lg)" }}
      >
        {TABS.map((tab, i) => {
          if (!tab) {
            return (
              <div key="fab" className="flex justify-center">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("thinkr:compose"))}
                  aria-label="Compose a thought"
                  className="relative -translate-y-6 w-[52px] h-[52px] rounded-full grid place-items-center text-white transition-transform active:scale-90"
                  style={{
                    background: "linear-gradient(135deg, var(--flame) 0%, var(--flame-deep) 100%)",
                    boxShadow: "0 0 0 5px var(--cream), 0 8px 28px rgba(244,74,38,0.42)",
                    animation: "fab-glow 3.5s ease-in-out infinite",
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          }
          const active = pathname.startsWith(tab.href);
          const { Icon } = tab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 h-full rounded-2xl transition-all"
              style={{ color: active ? "var(--flame)" : "var(--ink-40)" }}
            >
              <span
                className="grid place-items-center w-9 h-7 rounded-xl transition-all"
                style={{ background: active ? "rgba(244,74,38,0.12)" : "transparent" }}
              >
                <Icon className="w-[19px] h-[19px]" filled={tab.label === "Spark" && active} />
              </span>
              <span
                className="font-label"
                style={{ fontSize: "9px", letterSpacing: "0.06em", opacity: active ? 1 : 0.85 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
