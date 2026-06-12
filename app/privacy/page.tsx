import type { Metadata } from "next";
import { LegalShell, LegalSection, LegalList } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data Thinkr collects, how it is used, and the controls you have over it.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="June 11, 2026"
      intro={
        <>
          This Privacy Policy explains what information Thinkr collects, how we use it, and the choices you have. Thinkr is
          built connection-first: there are no likes, no public follower counts, and your sensitive matching information is
          never shown publicly or sold.
        </>
      }
    >
      <LegalSection n="1" title="Information We Collect">
        <LegalList
          items={[
            <>
              <b>Account information:</b> your email address, password (stored only in encrypted/hashed form by our
              authentication provider — we never see your plaintext password), username, and display name.
            </>,
            <>
              <b>Age verification:</b> we ask for your date of birth to confirm you are eligible. We store your{" "}
              <i>age</i> and whether you are 18+; we do not retain your full date of birth.
            </>,
            <>
              <b>Beta tester status:</b> if you join under the Authorized Beta Tester Exception, we record that you
              redeemed a valid beta code and the time you did so.
            </>,
            <>
              <b>Profile & content:</b> your bio, avatar, posts, comments, messages, and any media you upload.
            </>,
            <>
              <b>Thinking fingerprint & matching preferences:</b> your onboarding answers, gender, who you are open to
              matching with, preferred match age range, location (state/region), and — only if you opt in — your political
              lean. This sensitive matching data is private to you (owner-only) and is used solely to power Thought Twin
              matching.
            </>,
            <>
              <b>Basic usage data:</b> information needed to operate and secure the service.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n="2" title="How We Use Your Information">
        <LegalList
          items={[
            "To create and operate your account.",
            "To verify eligibility and enforce our 18+ requirement and the Authorized Beta Tester Exception.",
            "To power Thought Twin matching based on how you think and your matching preferences.",
            "To keep the community safe, investigate abuse, and enforce our Terms.",
            "To communicate important account and service information.",
          ]}
        />
      </LegalSection>

      <LegalSection n="3" title="What We Never Do">
        <LegalList
          items={[
            "We never sell your personal data.",
            "We never display your password, political lean, match preferences, or age to other users.",
            "We never show public vanity metrics (likes or follower counts).",
          ]}
        />
      </LegalSection>

      <LegalSection n="4" title="How Your Information Is Shared">
        <p>
          We share data only with the service providers that help us run Thinkr (for example, our hosting, database, and
          authentication provider), and only as needed to operate the Platform. We may disclose information if required by
          law or to protect the safety of our users.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Security">
        <p>
          We use industry-standard measures to protect your data, including encryption in transit, hashed passwords, and
          row-level security so that private data is accessible only to you. No system is perfectly secure, but we work to
          protect your information and limit access to it.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Your Rights & Choices">
        <LegalList
          items={[
            "You can edit your profile and matching preferences at any time.",
            "You can stop matching, block users, and restrict messaging whenever you want.",
            "You can delete your account and associated data at any time.",
            "You can manage cookies as described in our Cookie Policy.",
          ]}
        />
      </LegalSection>

      <LegalSection n="7" title="Under-18 Beta Testers">
        <p>
          Thinkr is an 18+ platform. The only under-18 users permitted are those approved under the Authorized Beta Tester
          Exception. For these accounts we collect the minimum information needed to operate the test, and these users are
          only ever matched with, and may only communicate with, other under-18 users. We expect approved under-18 testers
          to participate with the knowledge and consent of a parent or guardian.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Cookies">
        <p>
          Thinkr uses cookies and similar technologies to keep you signed in and to operate the service. See our{" "}
          <a href="/cookies" style={{ color: "var(--flame)", fontWeight: 600 }}>Cookie Policy</a> for details.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected by updating the
          &ldquo;Last updated&rdquo; date above.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Contact">
        <p>
          Privacy questions can be sent to{" "}
          <a href="mailto:jointhinkr@gmail.com" style={{ color: "var(--flame)", fontWeight: 600 }}>jointhinkr@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
