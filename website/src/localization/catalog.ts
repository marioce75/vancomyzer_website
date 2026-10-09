import { translateInvitationMessage } from "./interpolatedMessages";
import { translateNumericTemplate } from "./numericTemplates";
import messages from "./messages.json";
import ptBRAdditionalMessages from "./ptBRAdditionalMessages.json";
export const locales = ["en", "es", "fr", "pt-BR"] as const;
export type Locale = typeof locales[number];
export const localeCookie = "site-language";
export function parseLocale(value: unknown): Locale {
  return value === "es" || value === "fr" || value === "pt-BR" ? value : "en";
}
export function translate(source: string, locale: Locale): string {
  if (locale === "en") return source;
  if (locale === "pt-BR") {
    const extra = (ptBRAdditionalMessages as Record<string, string>)[source];
    if (extra) return extra;
  }
  const entry = (messages as Record<string, { es: string; fr: string; "pt-BR": string }>)[source];
  return entry?.[locale] ?? translateNumericTemplate(source, locale) ?? translateInvitationMessage(source, locale) ?? source;
}

/** Recover a catalogued source only for document metadata when switching languages. */
export function translateMetadataText(value: string, locale: Locale): string {
  function segment(text: string) {
    const catalog = messages as Record<string, { es: string; fr: string; "pt-BR": string }>;
    if (catalog[text]) return translate(text, locale);
    const original = Object.keys(catalog).find(key => catalog[key].es === text || catalog[key].fr === text || catalog[key]["pt-BR"] === text);
    return original ? translate(original, locale) : text;
  }
  const whole = segment(value);
  return whole !== value ? whole : value.split(" | ").map(segment).join(" | ");
}
