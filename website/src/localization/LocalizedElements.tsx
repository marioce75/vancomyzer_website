"use client";
import { createElement, forwardRef, type ComponentPropsWithoutRef, type ComponentRef, type JSX } from "react";
import { useLanguage } from "./LanguageProvider";

/** Localize descriptive attributes only. Values, names, IDs, events and refs are unchanged. */
function localizedElement<Tag extends keyof JSX.IntrinsicElements>(tag: Tag) {
  const Component = forwardRef<ComponentRef<Tag>, ComponentPropsWithoutRef<Tag>>(function LocalizedElement(props, ref) {
    const { t } = useLanguage();
    const translated = { ...props } as Record<string, unknown>;
    for (const attribute of ["aria-label", "alt", "title", "placeholder"]) {
      const value = translated[attribute];
      if (typeof value === "string") translated[attribute] = t(value);
    }
    return createElement(tag, { ...translated, ref });
  });
  Component.displayName = `Localized(${tag})`;
  return Component;
}

export const LocalizedA = localizedElement("a");
export const LocalizedAside = localizedElement("aside");
export const LocalizedButton = localizedElement("button");
export const LocalizedDiv = localizedElement("div");
export const LocalizedIframe = localizedElement("iframe");
export const LocalizedImg = localizedElement("img");
export const LocalizedInput = localizedElement("input");
export const LocalizedLabel = localizedElement("label");
export const LocalizedSection = localizedElement("section");
export const LocalizedSpan = localizedElement("span");
export const LocalizedTable = localizedElement("table");
export const LocalizedTextarea = localizedElement("textarea");
export const LocalizedTh = localizedElement("th");
export const LocalizedUl = localizedElement("ul");
export const LocalizedVideo = localizedElement("video");

export const LocalizedSvg = localizedElement("svg");
