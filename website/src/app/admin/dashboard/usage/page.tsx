
import { LocalizedText } from "@/localization/LanguageProvider";

import { LocalizedIframe } from "@/localization/LocalizedElements";
/**
 * Admin  Usage: the privacy-first analytics dashboard (Plausible or Umami).
 *
 * ANALYTICS_DASHBOARD_URL is deliberately server-only (no NEXT_PUBLIC_ prefix):
 * a shared dashboard link grants read access to the stats, so it must never be
 * inlined into public page code. This is a server component under /admin
 * (admin-only via middleware) rendered per request, so a changed link takes
 * effect without a rebuild.
 *
 * Embedding, checked 2026-09-14:
 *  - Plausible shared link: https://plausible.io/share/<domain>?auth=<slug>.
 *    The embed code Plausible generates adds embed=true and theme=light|dark|system
 *    (optional background=) (assets/js/app.js, docs "Embed the dashboard").
 *    Password-protected shared links cannot be embedded.
 *  - Umami share URL: https://<host>/share/<id>/<name>, embedded as-is. Self-hosted
 *    Umami may need ALLOWED_FRAME_URLS to include this site.
 */

export const dynamic = "force-dynamic";

const BRAND = "#1e4d8c";

type Dashboard =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ready"; embedSrc: string; openHref: string };

function readDashboard(): Dashboard {
  const raw = process.env.ANALYTICS_DASHBOARD_URL?.trim();
  if (!raw) return { status: "missing" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: "invalid" };
  }
  // Only plain web addresses may be framed or linked (rejects javascript: and similar).
  if (url.protocol !== "https:" && url.protocol !== "http:") return { status: "invalid" };

  const open = new URL(url.toString());
  open.searchParams.delete("embed"); // the "full dashboard" link should never open the stripped-down embed view

  const isPlausibleSharedLink = url.pathname.startsWith("/share/") && url.searchParams.has("auth");
  if (isPlausibleSharedLink) {
    if (!url.searchParams.has("embed")) url.searchParams.set("embed", "true");
    if (!url.searchParams.has("theme")) url.searchParams.set("theme", "light");
  }

  return { status: "ready", embedSrc: url.toString(), openHref: open.toString() };
}

/**
 * NEXT_PUBLIC_* values are inlined at build time in server code too, so this
 * reflects the settings the public pages were last published with.
 */
function countingStatus(): string {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (plausibleDomain) return `On (Plausible, counting visits to ${plausibleDomain})`;
  if (process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim()) return "On (Umami)";
  return "Off";
}

const MEASURED: { label: string; event?: string }[] = [
  { label: "Visitors and page views" },
  { label: "Countries, regions and cities" },
  { label: "New visitors (first visit from a browser)", event: "New Visitor" },
  { label: "Calculator opens", event: "Open Calculator" },
  { label: "Disclaimer acceptances", event: "Disclaimer Accepted" },
  { label: "Disclaimer declines", event: "Disclaimer Declined" },
  { label: "Completed manual calculations", event: "Calculation Run" },
  { label: "Tutorial plays", event: "Tutorial Play" },
];

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">{children}</code>;
}

export default function UsagePage() {
  const dashboard = readDashboard();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: BRAND }}><LocalizedText text={"Usage"} /></h1>
      <p className="text-sm text-gray-500 mb-6"><LocalizedText text={"Visitors, countries and calculator activity, counted without cookies. Patient values and dosing results are never sent."} /></p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1 text-xs text-gray-700">
          <dt className="text-gray-500"><LocalizedText text={"Visitor counting"} /></dt>
          <dd>{countingStatus()}</dd>
          <dt className="text-gray-500"><LocalizedText text={"Dashboard link"} /></dt>
          <dd>
            <LocalizedText text={dashboard.status === "ready" ? "Set" : dashboard.status === "invalid" ? "Saved, but not a valid web address" : "Not set"} />
          </dd>
        </dl>
      </div>

      {dashboard.status === "ready" ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <p className="text-xs text-gray-500"><LocalizedText text={"If the dashboard does not appear below, open it in a new tab. Password-protected shared links cannot be shown inside this page."} /></p>
            <a
              href={dashboard.openHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: BRAND }}
            ><LocalizedText text={"Open full dashboard"} /></a>
          </div>
          <LocalizedIframe
            src={dashboard.embedSrc}
            title="Usage dashboard"
            loading="lazy"
            className="w-full rounded border border-gray-200"
            style={{ height: 1600, colorScheme: "light" }}
          />
        </div>
      ) : (
        <>
          {dashboard.status === "invalid" && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm p-3 mb-4"><LocalizedText text={"The dashboard link saved as"} />{" "}<Code>ANALYTICS_DASHBOARD_URL</Code>{" "}<LocalizedText text={"is not a valid web address. It should start with https://."} /></div>
          )}
          <SetupSteps />
        </>
      )}

      <MeasuredCard />
    </div>
  );
}

function SetupSteps() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
      <h2 className="text-base font-bold mb-3" style={{ color: BRAND }}><LocalizedText text={"Set up usage reporting"} /></h2>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
        <li><LocalizedText text={"Create an account with"} />{" "}<strong>Plausible</strong>{" "}<LocalizedText text={"(plausible.io) or"} />{" "}<strong>Umami</strong>{" "}<LocalizedText text={"(umami.is). Both count visitors without cookies."} /></li>
        <li><LocalizedText text={"Add"} />{" "}<strong>vancomyzer.com</strong>{" "}<LocalizedText text={"as a website in that account."} /></li>
        <li><LocalizedText text={"Plausible only: under"} />{" "}<em><LocalizedText text={"Goals"} /></em><LocalizedText text={", add a custom event goal for each event name listed below, spelled exactly as shown. Umami lists these events on its own."} /></li>
        <li><LocalizedText text={"Create a shared link to the dashboard. In Plausible: site settings, then"} />{" "}<em><LocalizedText text={"Visibility"} /></em><LocalizedText text={", then"} />{" "}<em><LocalizedText text={"Shared links"} /></em><LocalizedText text={". Leave the password blank. In Umami: edit the website, then"} />{" "}<em><LocalizedText text={"Share URL"} /></em>.
        </li>
        <li><LocalizedText text={"In your hosting service's environment settings, add:"} /><ul className="list-disc pl-5 mt-1 space-y-1">
            <li><LocalizedText text={"For Plausible:"} />{" "}<Code>NEXT_PUBLIC_PLAUSIBLE_DOMAIN</Code>{" "}<LocalizedText text={"set to"} />{" "}<Code>vancomyzer.com</Code><LocalizedText text={". If Plausible's installation page shows an address starting with"} />{" "}<Code>https://plausible.io/js/pa-</Code><LocalizedText text={", also add"} />{" "}<Code>NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC</Code>{" "}<LocalizedText text={"set to that address. This is recommended: with it, admin and research pages are left out and patient values that can appear in calculator page addresses are removed before anything is sent."} /></li>
            <li><LocalizedText text={"For Umami:"} />{" "}<Code>NEXT_PUBLIC_UMAMI_WEBSITE_ID</Code>{" "}<LocalizedText text={"set to the website ID shown in Umami."} /></li>
            <li>
              <Code>ANALYTICS_DASHBOARD_URL</Code>{" "}<LocalizedText text={"set to the shared link from step 4."} /></li>
          </ul>
        </li>
        <li><LocalizedText text={"Save the settings and republish the site. Visitor counting starts once the site has been republished."} /></li>
      </ol>
    </div>
  );
}

function MeasuredCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-base font-bold mb-1" style={{ color: BRAND }}><LocalizedText text={"What gets measured"} /></h2>
      <p className="text-xs text-gray-500 mb-3"><LocalizedText text={"No cookies are used. Names, email addresses, patient values and dosing results are never sent, and reports are not linked to any account."} /></p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-700">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3 font-medium"><LocalizedText text={"Measure"} /></th>
              <th className="py-1 font-medium"><LocalizedText text={"Event name in the dashboard"} /></th>
            </tr>
          </thead>
          <tbody>
            {MEASURED.map((m) => (
              <tr key={m.label} className="border-t border-gray-100">
                <td className="py-1.5 pr-3"><LocalizedText text={m.label} /></td>
                <td className="py-1.5">{m.event ? <Code>{m.event}</Code> : <span className="text-gray-400"><LocalizedText text={"Standard report"} /></span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
