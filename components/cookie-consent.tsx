"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ACK_KEY = "thinkr_cookie_ack";

export default function CookieConsent() {
  // Render nothing until mounted + we know the stored state, to avoid a
  // hydration mismatch and a flash of the banner for users who already accepted.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACK_KEY)) setShow(true);
    } catch {
      // localStorage unavailable (private mode / blocked) — show the notice.
      setShow(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 flex justify-center"
      role="dialog"
      aria-label="Cookie notice"
    >
      <div
        className="w-full max-w-[560px] rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
      >
        <p className="text-[13px] flex-1" style={{ color: "var(--ink-60)", lineHeight: 1.5 }}>
          Thinkr uses essential cookies to keep you signed in and the app working. See our{" "}
          <Link href="/cookies" style={{ color: "var(--flame)", fontWeight: 600 }}>Cookie Policy</Link>.
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-5 py-2.5 rounded-full text-white text-[13px] font-semibold"
          style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
