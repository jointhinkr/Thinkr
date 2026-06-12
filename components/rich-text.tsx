import Link from "next/link";

// Renders text with #hashtags as tappable links to /tag/<tag>.
const TAG_SPLIT = /(#[a-zA-Z][a-zA-Z0-9_]{0,30})/g;
const isTag = (s: string) => /^#[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(s);

export default function RichText({ text }: { text: string }) {
  const parts = text.split(TAG_SPLIT);
  return (
    <>
      {parts.map((p, i) =>
        isTag(p) ? (
          <Link
            key={i}
            href={`/tag/${p.slice(1).toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--flame)", fontWeight: 600 }}
          >
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
