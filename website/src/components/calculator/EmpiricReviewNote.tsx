import React from "react";
import { translate, type Locale } from "@/localization/catalog";

export function EmpiricReviewHeading({ locale }: { locale: Locale }) {
  return <h2 id="vz-band-title" className="vz-panel-title m-0">{translate("Review required", locale)}</h2>;
}

export function EmpiricReviewNote({ note, locale }: { note: string; locale: Locale }) {
  // The engine joins whole, reviewed paragraphs by newline. Some catalog
  // keys contain two sentences, so generic sentence splitting loses them.
  const paragraphs = locale === "en" ? note : note.split("\n").map(line => translate(line, locale)).join("\n");
  return <pre className="m-0 whitespace-pre-wrap text-xs">{paragraphs}</pre>;
}
