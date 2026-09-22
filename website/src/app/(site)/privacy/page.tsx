import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Vancomyzer™",
  description: "What the calculator sends to the server, what is logged, and how analytics work.",
  alternates: { canonical: "https://vancomyzer.com/privacy" },
};

import CanonicalDocCallout from "@/components/CanonicalDocCallout";
import { PageHeader, Record, INK, INK2 } from "@/components/site/Record";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function PrivacyPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader kicker="Legal" title="Privacy Policy" compact lede={<span className="text-[15px]">Last updated: September 21, 2026</span>} />
      <Record label="Summary" note="The linked document on dosys.health governs." last>
      <CanonicalDocCallout docName="Privacy Policy" href={LEGAL_LINKS.privacy} />
      <div className="vz-prose mt-8 max-w-[70ch] space-y-8" style={{ color: INK2 }}>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>How Calculator Information Is Handled</h2>
          <p>
            The dosing calculation is performed on our server, not in your browser. The clinical values you enter (such as age, weight, height, sex, serum creatinine, the current regimen, and measured levels with their timing) are sent over an encrypted connection (HTTPS) to our server, which calculates the result and returns it to your screen. This can happen automatically while you are still entering values. The calculator does not ask for patient names, medical record numbers, dates of birth or other identifiers, and you must not enter them.
          </p>
          <p className="mt-3">
            Our server logs record only that a calculation ran, how long it took and which calculator version answered; they do not contain the clinical values you entered, the results or your account email. Fit-quality details are shown to you with the result and are not stored. If your plan includes calculation history, calculations you choose to save are kept with your account and an optional case label for 90 days. Earlier releases did record clinical values in server logs and fit-quality records; those older records and hosting backups are under a separate retention review and have not yet been confirmed deleted.

          </p>
          <p className="mt-3">
            So that your work is not lost if the page is refreshed, the calculator also keeps the values you entered within that browser tab. They are cleared when you reset the calculator or close the tab, and they are not restored after eight hours.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Important: Do Not Enter Identifiable Patient Information</h2>
          <p>
            Because the values you enter are sent to our server and recorded as described above, users should treat this tool as they would any clinical software: <strong>do not enter patient names, medical record numbers, dates of birth, or other personally identifiable information (PII) or protected health information (PHI)</strong> into any field. Clinical values and exact sample times can be identifiable in context. Do not use the public calculator for institutional patient-data research without an approved data arrangement.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Cookies and Analytics</h2>
          <p>
            We use a privacy-focused analytics service to understand how the site is used. It does not use cookies. It records the pages visited, the website that referred you (if any), your browser and device type, your approximate location (country, region or city), and a small set of anonymous usage events: the calculator being opened, the disclaimer being accepted or declined, a calculation being run, and a first visit from a browser.
          </p>
          <p className="mt-3">
            We do not send names, email addresses, account details, the clinical values you enter, dosing results or any other patient information to the analytics service. As with any website, the analytics service receives your device&apos;s internet (IP) address when a page loads; it is used to estimate your location and to count visits, and it is not shown in our reports. To count a first visit only once, your browser keeps a simple marker on this device. The marker contains no identifier, is not a cookie, and is never sent to us or to the analytics service.
          </p>
          <p className="mt-3">
            Analytics reports are aggregated and are not linked to any name, email address or account. We do not use advertising, advertising pixels or tracking cookies. If you sign in to an account, the site uses cookies that keep you signed in.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Third-Party Services</h2>
          <p>
            This site may be hosted on third-party infrastructure. Hosting providers may collect standard server logs (IP addresses, access times) for operational purposes. How long hosting records and backups are kept must be reviewed for the service as it is configured; this policy does not certify that every historical record is anonymous.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>HIPAA Notice</h2>
          <p>
            Whether a business-associate relationship or other data agreement is required depends on the actual data and institutional use. The absence of names does not automatically make clinical data anonymous. Do not submit PHI to this public service. Institutional patient-data processing requires prior privacy, security and contractual review; this page is not a compliance certification.

          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Changes to This Policy</h2>
          <p>
            This privacy policy may be updated as the tool evolves. The date at the top of this page reflects the most recent revision. Continued use after updates constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Contact</h2>
          <p>
            For privacy-related questions or concerns, please use the <a href="/contact" className="text-blue-600 underline hover:text-blue-800">Contact</a> page.
          </p>
        </section>

      </div>
      </Record>
    </div>
  );
}
