import { translate, type Locale } from "./catalog";

/** Presentation-only translation of generated prose. Each complete sentence or
 * labelled field must match a reviewed catalog entry; unknown fragments stay
 * verbatim. Responses, numerical values, units and clinical state are untouched. */
export function translateGeneratedText(source: string, locale: Locale): string {
  if (locale === "en") return source;
  // Keep parenthesised clinical caveats with the sentence they qualify.
  function sentences(text: string): string[] {
    const parts: string[] = [];
    let start = 0, nesting = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "(") nesting++;
      else if (text[i] === ")") nesting = Math.max(0, nesting - 1);
      const newline = text[i] === "\n";
      const boundary = !nesting && text[i] === " " && /[.!?]/.test(text[i - 1] ?? "");
      if (!newline && !boundary) continue;
      let end = i;
      while (end < text.length && (newline ? text[end] === "\n" : text[end] === " ")) end++;
      if (!newline && !/[A-Z]/.test(text[end] ?? "")) continue;
      parts.push(text.slice(start, i), text.slice(i, end));
      start = end; i = end - 1;
    }
    parts.push(text.slice(start));
    return parts;
  }
  function render(text: string, depth: number): string {
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    const core = text.trim();
    if (!core) return text;
    const translated = translate(core, locale);
    if (translated !== core) return leading + translated + trailing;
    if (depth === 0) return sentences(text).map(part => render(part, 1)).join("");
    if (depth === 1) return text.split(/(: |; | — )/).map(part => render(part, 2)).join("");
    // Preserve numbering and status codes while translating the reviewed message.
    const numbered = /^(\d+\. |\[[A-Z-]+\] )(.+)$/.exec(core);
    if (numbered) return leading + numbered[1] + translate(numbered[2], locale) + trailing;
    return text;
  }
  return render(source, 0);
}
