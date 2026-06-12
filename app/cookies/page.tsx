import type { Metadata } from "next";
import { LegalShell, LegalSection, LegalList } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Thinkr uses cookies and similar technologies, and the choices you have.",
};

export default function CookiesPage() {
  return (
    <LegalShell
      title="Cookie Policy"
      updated="June 11, 2026"
      intro={
        <>
          This Cookie Policy explains how Thinkr uses cookies and similar technologies (such as local storage) when you use
          the Platform, and the choices available to you. For more on how we handle your data, see our{" "}
          <a href="/privacy" style={{ color: "var(--flame)", fontWeight: 600 }}>Privacy Policy</a>.
        </>
      }
    >
      <LegalSection n="1" title="What Are Cookies?">
        <p>
          Cookies are small text files stored on your device. Similar technologies like local storage let a site remember
          information between visits. We use both to keep Thinkr working and to remember your preferences.
        </p>
      </LegalSection>

      <LegalSection n="2" title="How We Use Them">
        <LegalList
          items={[
            <>
              <b>Essential cookies.</b> Required to run the Platform — for example, keeping you securely signed in. These
              cannot be turned off without breaking core functionality.
            </>,
            <>
              <b>Preference storage.</b> We remember choices such as whether you have acknowledged this cookie notice, so we
              do not ask you again.
            </>,
          ]}
        />
        <p>
          Thinkr does not use advertising cookies, and we do not sell your data. We have no likes or follower counts to
          track.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Managing Cookies">
        <p>
          You can control and delete cookies through your browser settings. Because some cookies are essential to keep you
          signed in, blocking all cookies may prevent parts of Thinkr from working. Clearing your browser&apos;s storage
          will also reset your cookie acknowledgement, and you may see the notice again.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Changes to This Policy">
        <p>
          We may update this Cookie Policy from time to time. Material changes will be reflected by updating the
          &ldquo;Last updated&rdquo; date above.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Contact">
        <p>
          Questions about cookies can be sent to{" "}
          <a href="mailto:jointhinkr@gmail.com" style={{ color: "var(--flame)", fontWeight: 600 }}>jointhinkr@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
