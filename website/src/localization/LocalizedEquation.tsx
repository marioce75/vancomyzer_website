"use client";

import { useLanguage } from "./LanguageProvider";
import { translateEquationAnnotations } from "./equationAnnotations";

export function LocalizedEquation({ text }: { text: string }) {
  const { locale } = useLanguage();
  return <>{translateEquationAnnotations(text, locale)}</>;
}
