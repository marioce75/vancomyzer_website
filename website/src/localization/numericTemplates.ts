import templates from "./templates.json";

type Translation = { es: string; fr: string };
// Only explicitly catalogued numeric templates can match. Captures are inserted
// byte-for-byte: no parsing, rounding, unit conversion or clinical calculation.
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = Object.entries(templates as Record<string, Translation>).map(([source, translations]) => {
  const names = Array.from(source.matchAll(/\{(n\d+)\}/g), match => match[1]);
  const pattern = source.split(/\{n\d+\}/g).map(escapeRegex).join("(-?\\d+(?:[.,]\\d+)*)");
  return { names, regex: new RegExp(`^${pattern}$`), translations };
});
export function translateNumericTemplate(source: string, locale: "es" | "fr"): string | undefined {
  for (const entry of compiled) {
    const match = entry.regex.exec(source);
    if (!match) continue;
    const captures = Object.fromEntries(entry.names.map((name, index) => [name, match[index + 1]]));
    return entry.translations[locale].replace(/\{(n\d+)\}/g, (_, name: string) => captures[name]);
  }
  return undefined;
}
