type Props = {
  name?: string | null;
  src?: string | null;
  size?: number;
  color?: string;
  className?: string;
};

// Default = the orangey "aura" initial; shows the uploaded photo when `src` is set.
export default function Avatar({ name, src, size = 40, color = "var(--flame)", className = "" }: Props) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const dim = { width: size, height: size } as const;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || "avatar"}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={dim}
      />
    );
  }
  return (
    <div
      className={`rounded-full grid place-items-center text-white font-bold shrink-0 ${className}`}
      style={{ ...dim, background: `linear-gradient(135deg, ${color}, var(--amber))`, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  );
}
