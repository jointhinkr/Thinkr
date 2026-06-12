"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SuspendedPage() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-[440px] rounded-[24px] p-7 text-center" style={{ background: "var(--paper)", boxShadow: "var(--shadow-lg)" }}>
        <div className="text-3xl mb-3">🚫</div>
        <h1 className="font-display text-[26px] leading-tight" style={{ fontWeight: 600, color: "var(--ink-1)" }}>
          Your access is suspended
        </h1>
        <p className="mt-3 text-[15px]" style={{ color: "var(--ink-60)", lineHeight: 1.6 }}>
          Your account has been suspended following a safety review for a possible violation of Thinkr&apos;s Terms and
          Community Guidelines. Messaging, posting, and matching are disabled.
        </p>
        <p className="mt-3 text-[14px]" style={{ color: "var(--ink-60)", lineHeight: 1.6 }}>
          If you believe this was a mistake, you can appeal by emailing{" "}
          <a href="mailto:jointhinkr@gmail.com" style={{ color: "var(--flame)", fontWeight: 600 }}>jointhinkr@gmail.com</a>.
        </p>
        <button onClick={signOut}
          className="mt-6 w-full px-6 py-3.5 rounded-full text-sm font-semibold"
          style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
