export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: March 2026</p>

      <div className="mt-8 space-y-8 text-slate-700">

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No Collection of Patient Data</h2>
          <p>
            Vancomyzer™ does not collect, store, transmit, or retain any patient information entered into the calculator. All pharmacokinetic calculations are performed locally within your browser session and are not sent to any server or third party. No patient data persists after your session ends.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Important: Do Not Enter Identifiable Patient Information</h2>
          <p>
            Although no data is collected, users should treat this tool as they would any clinical software: <strong>do not enter patient names, medical record numbers, dates of birth, or other personally identifiable information (PII) or protected health information (PHI)</strong> into any field. The tool only requires anonymous clinical parameters (age, weight, renal function, etc.) to function.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Cookies and Analytics</h2>
          <p>
            This site does not currently use tracking cookies, advertising pixels, or behavioral analytics. If analytics are added in the future, this policy will be updated and users will be notified.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Third-Party Services</h2>
          <p>
            This site may be hosted on third-party infrastructure. Hosting providers may collect standard server logs (IP addresses, access times) for operational purposes. These logs are not linked to patient data and are subject to the hosting provider&apos;s own privacy practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">HIPAA Notice</h2>
          <p>
            Vancomyzer™ is not a HIPAA-covered entity and does not function as a business associate. As stated above, no PHI is transmitted or stored through this tool. Users remain responsible for ensuring their use of this tool complies with applicable privacy regulations including HIPAA, GDPR, and any applicable state or local laws.
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
