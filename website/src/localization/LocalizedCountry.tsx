"use client";
import { useLanguage } from './LanguageProvider';
export function LocalizedCountry({ code, name }: { code: string; name: string }) {
  const { locale } = useLanguage();
  if (locale === 'en') return <>{name}</>;
  return <>{new Intl.DisplayNames([locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'fr-FR'], { type: 'region' }).of(code) ?? name}</>;
}

/** Localize a known ISO country label without changing stored country codes. */
export function useCountryLabel() {
  const { locale } = useLanguage();
  return (code: string, fallback: string) => {
    if (locale === 'en') return fallback;
    try { return new Intl.DisplayNames([locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'fr-FR'], {type:'region'}).of(code) ?? fallback; }
    catch { return fallback; }
  };
}
