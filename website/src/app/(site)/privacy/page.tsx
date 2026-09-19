import CanonicalDocCallout from "@/components/CanonicalDocCallout";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: September 19, 2026</p>

      <CanonicalDocCallout docName="Privacy Policy" href={LEGAL_LINKS.privacy} />

      <div className="mt-8 space-y-8 text-slate-700">

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">How Calculator Information Is Handled</h2>
          <p>
            The dosing calculation is performed on our server, not in your browser. The clinical values you enter (such as age, weight, height, sex, serum creatinine, the current regimen, and measured levels with their timing) are sent over an encrypted connection (HTTPS) to our server, which calculates the result and returns it to your screen. This can happen automatically while you are still entering values. The calculator does not ask for patient names, medical record numbers, dates of birth or other identifiers, and you must not enter them.
          </p>
          <p className="mt-3">
            Operational calculation logs contain request status, processing time and model version, without clinical inputs, results or account email. Fit diagnostics are returned with the result but are not written to security logs. If your plan includes calculation history, explicit calculations can still be stored with your account and optional case label for 90 days. Older releases recorded clinical values in operational logs and fit-diagnostic records; historical records and hosting backups remain subject to a separate retention review. These changes do not establish that old records have been deleted.

          </p>
          <p className="mt-3">
            So that your work is not lost if the page is refreshed, the calculator also keeps the values you entered within that browser tab. They are cleared when you reset the calculator or close the tab, and they are not restored after eight hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Important: Do Not Enter Identifiable Patient Information</h2>
          <p>
            Because the values you enter are sent to our server and recorded as described above, users should treat this tool as they would any clinical software: <strong>do not enter patient names, medical record numbers, dates of birth, or other personally identifiable information (PII) or protected health information (PHI)</strong> into any field. Clinical values and exact sample times can be identifiable in context. Do not use the public calculator for institutional patient-data research without an approved data arrangement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Cookies and Analytics</h2>
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
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Third-Party Services</h2>
          <p>
            This site may be hosted on third-party infrastructure. Hosting providers may collect standard server logs (IP addresses, access times) for operational purposes. How long hosting records and backups are kept must be reviewed for the service as it is configured; this policy does not certify that every historical record is anonymous.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">HIPAA Notice</h2>
          <p>
            Whether a business-associate relationship or other data agreement is required depends on the actual data and institutional use. The absence of names does not automatically make clinical data anonymous. Do not submit PHI to this public service. Institutional patient-data processing requires prior privacy, security and contractual review; this page is not a compliance certification.

          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Changes to This Policy</h2>
          <p>
            This privacy policy may be updated as the tool evolves. The date at the top of this page reflects the most recent revision. Continued use after updates constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Contact</h2>
          <p>
            For privacy-related questions or concerns, please use the <a href="/contact" className="text-blue-600 underline hover:text-blue-800">Contact</a> page.
          </p>
        </section>

      </div>
    </div>
  );
}
