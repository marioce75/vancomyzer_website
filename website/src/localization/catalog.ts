import { translateInvitationMessage } from "./interpolatedMessages";
import { translateNumericTemplate } from "./numericTemplates";
import messages from "./messages.json";
export const locales = ["en", "es", "fr"] as const;
export type Locale = typeof locales[number];
export const localeCookie = "site-language";
export function parseLocale(value: unknown): Locale {
  return value === "es" || value === "fr" ? value : "en";
}
export function translate(source: string, locale: Locale): string {
  if (locale === "en") return source;
  const entry = (messages as Record<string, { es: string; fr: string }>)[source];
  return entry?.[locale] ?? translateNumericTemplate(source, locale) ?? translateInvitationMessage(source, locale) ?? source;
}

/** Recover a catalogued source only for document metadata when switching languages. */
export function translateMetadataText(value: string, locale: Locale): string {
  function segment(text: string) {
    const catalog = messages as Record<string, { es: string; fr: string }>;
    if (catalog[text]) return translate(text, locale);
    const original = Object.keys(catalog).find(key => catalog[key].es === text || catalog[key].fr === text);
    return original ? translate(original, locale) : text;
  }
  const whole = segment(value);
  return whole !== value ? whole : value.split(" | ").map(segment).join(" | ");
}
