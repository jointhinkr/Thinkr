import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/cookie-consent";

export const metadata: Metadata = {
  metadataBase: new URL("https://thinkr.social"),
  title: { default: "Thinkr — find your thought twin", template: "%s · Thinkr" },
  description:
    "Find the people who actually get you — matched by how you think, not by followers or likes. No likes. No performing. Just your people.",
  openGraph: {
    title: "Thinkr — find the people who actually get you",
    description:
      "A connection-first social platform. Matched by how you think. No likes, no follower counts, no performing.",
    url: "https://thinkr.social",
    siteName: "Thinkr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thinkr — find the people who actually get you",
    description: "Matched by how you think. No likes. No performing. Just your people.",
  },
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
        <CookieConsent />
      </body>
    </html>
  );
}
