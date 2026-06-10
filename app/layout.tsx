import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thinkr — find your thought twin",
  description:
    "A connection-first social platform. Find people by how they think, not by followers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
