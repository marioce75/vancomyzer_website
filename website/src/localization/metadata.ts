import type { Metadata } from "next";
import { translate, type Locale } from "./catalog";

/** Translate descriptive metadata only; URLs, identities, robots and schema stay intact. */
export function localizeMetadata(source: Metadata, locale: Locale): Metadata {
  const t = (text: string) => translate(text, locale);
  const title = source.title;
  const localizedTitle = typeof title === "string" ? t(title) : title ? {
    ...title,
    ...("default" in title ? { default: t(title.default) } : {}),
    ...("absolute" in title ? { absolute: t(title.absolute) } : {}),
    ...("template" in title && title.template ? { template: t(title.template) } : {}),
  } : title;
  function images(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(images);
    if (value && typeof value === "object" && "alt" in value && typeof value.alt === "string") return { ...value, alt: t(value.alt) };
    return value;
  }
  return {
    ...source,
    title: localizedTitle,
    ...(source.description ? { description: t(source.description) } : {}),
    ...(source.keywords ? { keywords: Array.isArray(source.keywords) ? source.keywords.map(t) : t(source.keywords) } : {}),
    ...(source.openGraph ? { openGraph: {
      ...source.openGraph,
      ...(typeof source.openGraph.title === "string" ? { title: t(source.openGraph.title) } : {}),
      ...(source.openGraph.description ? { description: t(source.openGraph.description) } : {}),
      images: images(source.openGraph.images),
      locale: locale === "pt-BR" ? "pt_BR" : locale === "es" ? "es_ES" : locale === "fr" ? "fr_FR" : source.openGraph.locale,
    } as Metadata["openGraph"] } : {}),
    ...(source.twitter ? { twitter: {
      ...source.twitter,
      ...(typeof source.twitter.title === "string" ? { title: t(source.twitter.title) } : {}),
      ...(source.twitter.description ? { description: t(source.twitter.description) } : {}),
      ...("images" in source.twitter ? { images: images(source.twitter.images) } : {}),
    } as Metadata["twitter"] } : {}),
  };
}
