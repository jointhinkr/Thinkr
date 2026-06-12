import Link from "next/link";

// Shared chrome for the public legal pages (/terms, /privacy, /cookies).
// Server component — pure layout, no interactivity.

export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--cream)" }}>
      <div className="mx-auto w-full max-w-[720px] px-5 pt-8 pb-20">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="font-display italic text-[20px]" style={{ color: "var(--flame)", fontWeight: 600 }}>
            Thinkr
          </Link>
          <Link href="/flux" className="text-[13px] font-semibold" style={{ color: "var(--ink-60)" }}>
            ← Back to Thinkr
          </Link>
        </div>

        <h1 className="font-display leading-[1.1]" style={{ fontSize: "clamp(28px,6vw,40px)", fontWeight: 600, color: "var(--ink-1)" }}>
          {title}
        </h1>
        <p className="font-label mt-3" style={{ fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)" }}>
          Last updated {updated}
        </p>

        {intro && (
          <p className="mt-5 text-[16px]" style={{ color: "var(--ink-60)", lineHeight: 1.6 }}>
            {intro}
          </p>
        )}

        <div className="mt-8 space-y-7">{children}</div>

        <div className="mt-12 pt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold"
          style={{ borderTop: "1px solid var(--line)", color: "var(--flame)" }}>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/cookies">Cookie Policy</Link>
        </div>
        <p className="mt-5 text-[12px]" style={{ color: "var(--ink-40)", lineHeight: 1.6 }}>
          These documents are provided to explain how Thinkr works and the rules of the community. They do not constitute
          legal advice. Thinkr is an early-stage product; terms may change as the platform evolves.
        </p>
      </div>
    </div>
  );
}

// Prominent, highlighted acknowledgment box for express-agreement language.
export function LegalCallout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5" style={{ background: "#FFF6EC", border: "2px solid var(--flame)" }}>
      <h2 className="font-display" style={{ fontSize: "20px", fontWeight: 600, color: "var(--ink-1)" }}>
        {title}
      </h2>
      <div className="mt-2.5 space-y-3 text-[15.5px]" style={{ color: "var(--ink-1)", lineHeight: 1.65 }}>
        {children}
      </div>
    </section>
  );
}

// Section heading + body block.
export function LegalSection({ n, title, children }: { n?: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display" style={{ fontSize: "21px", fontWeight: 600, color: "var(--ink-1)" }}>
        {n ? `${n}. ` : ""}{title}
      </h2>
      <div className="mt-2.5 space-y-3 text-[15.5px]" style={{ color: "var(--ink-60)", lineHeight: 1.65 }}>
        {children}
      </div>
    </section>
  );
}

// Bulleted list with consistent styling.
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span style={{ color: "var(--flame)", fontWeight: 700 }}>•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
