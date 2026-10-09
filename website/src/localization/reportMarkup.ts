import { type Locale } from "./catalog";
import { translateGeneratedText } from "./generatedText";

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** For this application's trusted, already-escaped report template only.
 * Translate text nodes, never HTML attributes, links, styles or response data.
 * Escaping is reapplied after translation; unrecognised nodes retain their bytes. */
export function localizeReportMarkup(html: string, locale: Locale): string {
  if (locale === "en") return html;
  let protectedTag = "";
  let preserveSpan = false;
  return html.split(/(<[^>]*>)/g).map(part => {
    if (part.startsWith("<")) {
      if (part.startsWith('<span data-localization="preserve"')) preserveSpan = true;
      else if (preserveSpan && /^<\/span>/i.test(part)) preserveSpan = false;
      const opening = /^<(style|script)\b/i.exec(part);
      if (opening) protectedTag = opening[1].toLowerCase();
      if (protectedTag && part.toLowerCase().startsWith(`</${protectedTag}`)) protectedTag = "";
      if (/^<html\b/i.test(part)) return part.replace('lang="en"', `lang="${locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "fr-FR"}"`);
      return part;
    }
    if (protectedTag || preserveSpan) return part;
    const decoded = part.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => entities[entity]);
    const localized = translateGeneratedText(decoded, locale);
    return localized === decoded ? part : escapeText(localized);
  }).join("");
}
