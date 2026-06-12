import type { Metadata } from "next";
import { LegalShell, LegalSection, LegalList, LegalCallout } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules of the Thinkr community and the terms governing your use of the platform.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      updated="June 11, 2026"
      intro={
        <>
          Welcome to Thinkr. These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and Thinkr
          and govern your access to and use of the Thinkr website, apps, and services (together, the
          &ldquo;Platform&rdquo;). By creating an account, checking the acceptance box, or using the Platform, you confirm
          that you have read, understood, and agree to these Terms and our{" "}
          <a href="/privacy" style={{ color: "var(--flame)", fontWeight: 600 }}>Privacy Policy</a> and{" "}
          <a href="/cookies" style={{ color: "var(--flame)", fontWeight: 600 }}>Cookie Policy</a>. If you do not agree, do
          not use the Platform.
        </>
      }
    >
      <LegalCallout title="Your Express Agreement — Please Read">
        <p>
          By creating an account, checking any acceptance box, entering a beta access code, or otherwise accessing or
          using the Platform, <b>you expressly acknowledge, understand, and agree that:</b>
        </p>
        <LegalList
          items={[
            <>
              You agree that you are <b>18 years of age or older</b>, or an authorized under-18 beta tester with a valid
              code, and that the age and date-of-birth information you provide is accurate.
            </>,
            <>
              You agree that you have <b>read, understood, and accept</b> these Terms, the{" "}
              <a href="/privacy" style={{ color: "var(--flame)", fontWeight: 600 }}>Privacy Policy</a>, and the{" "}
              <a href="/cookies" style={{ color: "var(--flame)", fontWeight: 600 }}>Cookie Policy</a>, and that they form
              a binding legal agreement between you and Thinkr.
            </>,
            <>
              You agree that you use Thinkr <b>entirely at your own risk</b>, and you knowingly and voluntarily{" "}
              <b>assume all risk</b> arising from your interactions with other users and from attending any gathering,
              meetup, livestream, or event, whether online or in person.
            </>,
            <>
              You agree and acknowledge that Thinkr <b>does not vet, supervise, chaperone, or endorse</b> users, content,
              or events, and that Thinkr is <b>not responsible or liable</b> for the conduct of any user or for any
              injury, loss, damage, or harm of any kind arising from your use of the Platform.
            </>,
            <>
              You agree that you <b>will not</b> post, send, or share harmful, threatening, self-harm or suicidal,
              explicit, sexual, or otherwise inappropriate content anywhere on Thinkr, and you acknowledge that{" "}
              <b>Thinkr is not a dating platform</b>.
            </>,
            <>
              To the fullest extent permitted by law, you agree to <b>release, waive, and hold harmless</b> Thinkr and its
              founders, operators, and affiliates from any and all claims, and you agree to the limitation of liability
              and indemnification provisions in Sections 11 and 12 below.
            </>,
            <>
              You agree that Thinkr may <b>suspend, restrict, or permanently remove</b> your access at any time, without
              notice, for any violation of these Terms.
            </>,
          ]}
        />
        <p style={{ fontWeight: 600 }}>
          If you do not agree to all of the above, do not create an account and do not use the Platform.
        </p>
      </LegalCallout>

      <LegalSection n="1" title="Eligibility & Age Requirement">
        <p>
          Thinkr is intended for individuals who are at least eighteen (18) years of age. By using the Platform you
          represent and warrant that you are 18 or older, except where you have been expressly approved under the
          Authorized Beta Tester Exception in Section 2. You are responsible for the accuracy of the age and date-of-birth
          information you provide. Providing false information to bypass our age controls is a material breach of these
          Terms and may result in immediate, permanent removal.
        </p>
      </LegalSection>

      <LegalSection n="2" title="Authorized Beta Tester Exception">
        <p>
          Although Thinkr is intended for individuals who are at least eighteen (18) years of age, Thinkr may, at its sole
          discretion, authorize certain individuals under the age of eighteen (18) to access and use the platform solely
          for internal testing, quality assurance, feedback, and product development purposes.
        </p>
        <p>Eligibility under this exception requires:</p>
        <LegalList
          items={[
            "A valid beta invitation or authorization issued directly by Thinkr.",
            "Entry of a valid beta access code or other verification method designated by Thinkr.",
            "Compliance with all other Terms of Service and Community Guidelines.",
          ]}
        />
        <p>
          Participation as an authorized beta tester does not create a permanent right to use the platform and may be
          suspended or terminated at any time without notice.
        </p>
        <p>
          Users who falsely represent themselves as authorized beta testers or misuse a beta access code may have their
          accounts permanently removed.
        </p>
        <p>
          Thinkr reserves the right to modify or discontinue the Authorized Beta Tester Program at any time and for any
          reason. Authorized beta testers under 18 are only ever matched, and may only communicate, with other users
          under 18.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Your Account">
        <p>
          You are responsible for safeguarding your login credentials and for all activity that occurs under your
          account. Do not share your password or your beta access code. Notify us immediately if you suspect unauthorized
          use. You may delete your account and associated data at any time.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Gatherings, Meetups & Live Events">
        <p>
          Thinkr may surface community gatherings, meetups, and live rooms (including features such as Gather and Ignite).
          Thinkr does not organize, host, supervise, vet, chaperone, or endorse these events or the people who attend
          them, whether they take place online or in person.
        </p>
        <p>
          <b>You attend any gathering entirely at your own risk.</b> If you do not want to assume that risk, do not
          attend. To the fullest extent permitted by law, Thinkr is not responsible or liable for any injury, loss,
          damage, or harm of any kind arising before, during, or after any gathering, meetup, or event, including the
          conduct of other attendees. Use common sense: meet in public, tell someone where you are going, and do not share
          sensitive personal information.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Community Conduct & Prohibited Content">
        <p>
          Thinkr is a space for ideas and genuine connection. To keep it safe, the following are strictly prohibited
          anywhere on the Platform — in posts, comments, messages, profiles, live rooms, or any other Thinkr database or
          surface:
        </p>
        <LegalList
          items={[
            <>
              <b>Harmful, threatening, or violent content.</b> No threats, harassment, bullying, hate speech, or
              encouragement of violence toward yourself or others.
            </>,
            <>
              <b>Self-harm & suicidal content.</b> No messages or posts that promote, encourage, or graphically describe
              self-harm or suicidal ideation. Violations may result in loss of access to your account.
            </>,
            <>
              <b>Explicit, sexual, or inappropriate content.</b> Thinkr is not a dating platform. No explicit, sexual, or
              otherwise inappropriate messages, imagery, or concepts may be written, posted, or shared anywhere on Thinkr.
            </>,
            <>
              <b>Illegal activity</b> or content that infringes the rights of others.
            </>,
          ]}
        />
        <p>
          Violating these rules may result in content removal, suspension, or permanent loss of access to your account,
          at Thinkr&apos;s sole discretion and without notice.
        </p>
        <p style={{ fontSize: "14px", color: "var(--ink-40)" }}>
          If you are struggling or in crisis, please reach out for help. In the U.S. you can call or text{" "}
          <b>988</b> (Suicide &amp; Crisis Lifeline), available 24/7. If you or someone else is in immediate danger, call
          911 or your local emergency number.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Thought Twin Matching Is Optional">
        <p>
          Thought Twin matching is never forced. If at any time you feel uncomfortable, you may switch your twin, stop
          matching, restrict access to messaging, block a user, or refrain from using the feature altogether. You control
          who you connect with, and connection requests require mutual acceptance before messaging begins. Matching never
          crosses the 18 line: adults are only matched with adults, and under-18 users are only matched with other
          under-18 users.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Live Rooms & Reporting">
        <p>
          Livestreams and live rooms may be reported. Where there is explicit, inappropriate, harmful, or rule-violating
          behavior, Thinkr may restrict, suspend, or remove access to live features, end a room, or remove a participant,
          at its discretion and without notice.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Your Content">
        <p>
          You retain ownership of the content you create. By posting, you grant Thinkr a limited, non-exclusive license to
          host, store, and display your content for the purpose of operating the Platform. You are responsible for your
          content and confirm you have the right to share it. Thinkr may remove content that violates these Terms.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Termination">
        <p>
          Thinkr may suspend or terminate your access at any time, with or without notice, for any violation of these
          Terms or to protect the community. You may stop using the Platform and delete your account at any time.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Disclaimers">
        <p>
          The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis, without warranties of
          any kind, express or implied, to the fullest extent permitted by law. Thinkr does not warrant that the Platform
          will be uninterrupted, secure, or error-free, and does not endorse or vet other users or the content they post.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Thinkr and its founders, operators, and affiliates will not be liable
          for any indirect, incidental, special, consequential, or punitive damages, or for any loss or harm arising out
          of your use of the Platform, your interactions with other users, or your attendance at any gathering, meetup,
          or event. Your sole remedy if you are dissatisfied is to stop using the Platform.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Indemnification">
        <p>
          You agree to indemnify and hold harmless Thinkr and its founders, operators, and affiliates from any claims,
          damages, losses, or expenses arising out of your use of the Platform, your content, your conduct, or your
          violation of these Terms or the rights of others.
        </p>
      </LegalSection>

      <LegalSection n="13" title="Changes to These Terms">
        <p>
          Thinkr may update these Terms from time to time. Material changes will be reflected by updating the &ldquo;Last
          updated&rdquo; date above. Your continued use of the Platform after changes take effect constitutes acceptance
          of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection n="14" title="Contact">
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:jointhinkr@gmail.com" style={{ color: "var(--flame)", fontWeight: 600 }}>jointhinkr@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
