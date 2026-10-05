"use client";
import { translateGeneratedText } from "./generatedText";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { localeCookie, parseLocale, translate, translateMetadataText, type Locale } from "./catalog";

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

/** Language is presentation state: switching never navigates or remounts a calculator. */
export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en";
    document.title = translateMetadataText(document.title, locale);
    const selectors = ["meta[name=description]", "meta[property='og:title']", "meta[property='og:description']", "meta[property='og:image:alt']", "meta[name='twitter:title']", "meta[name='twitter:description']", "meta[name='twitter:image:alt']"];
    document.querySelectorAll<HTMLMetaElement>(selectors.join(",")).forEach(meta => {
      meta.content = translateMetadataText(meta.content, locale);
    });
    const ogLocale = document.querySelector<HTMLMetaElement>("meta[property='og:locale']");
    if (ogLocale) ogLocale.content = locale === "es" ? "es_ES" : locale === "fr" ? "fr_FR" : "en_US";
  }, [locale, pathname]);
  function setLocale(value: Locale) {
    const next = parseLocale(value);
    updateLocale(next);
    // Only a public language preference; no patient data is stored here.
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, t: (source: string) => translate(source, context.locale) };
}

/** English source is retained verbatim when a reviewed translation is unavailable. */
export function LocalizedText({ text }: { text: ReactNode }) {
  const { t } = useLanguage();
  return <>{typeof text === "string" ? t(text) : text}</>;
}

const subscribeHydration = () => () => {};

export function LanguageSwitcher() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const { locale, setLocale } = useLanguage();
  const id = useId();
  const label = { en: "Language", es: "Idioma", fr: "Langue" }[locale];
  return <div className="language-switcher" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "8px 16px", fontSize: 14 }}>
    <label htmlFor={id}>{label}</label>
    <select id={id} disabled={!hydrated} value={locale} onChange={event => setLocale(parseLocale(event.target.value))}
      style={{ maxWidth: "100%", padding: "6px 10px", border: "1px solid currentColor", background: "var(--color-bg, #fff)", color: "inherit" }}>
      <option value="en" lang="en">English</option>
      <option value="es" lang="es-ES">Español</option>
      <option value="fr" lang="fr-FR">Français</option>
    </select>
  </div>;
}

/** Generated prose is translated only through reviewed whole-sentence bindings. */
export function LocalizedGeneratedText({ text }: { text: string }) {
  const { locale } = useLanguage();
  return <>{translateGeneratedText(text, locale)}</>;
}
