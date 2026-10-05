import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";

import { LocalizedText } from "@/localization/LanguageProvider";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Record, INK, INK2 } from "@/components/site/Record";
import { FAQ_ITEMS, type FaqItem } from "./faqContent";

const englishMetadata: Metadata = {
  title: "Vancomyzer Calculator FAQ | Methods, Inputs & Limitations",
  description: "Why Vancomyzer uses the Colin 2019 model, how it treats serum creatinine and body weight, and what has and has not been validated.",
  alternates: { canonical: "https://vancomyzer.com/faq" },
};

/* ── FAQ Data ──────────────────────────────────────────────────── */

/* ── Item ──────────────────────────────────────────────────────── */

function FaqEntry({ item, index }: { item: FaqItem; index: number }) {
  return (
    <details id={`q${index + 1}`}>
      <summary>
        <span><LocalizedText text={item.question} /></span>
      </summary>
      <div className="vz-faq-body">
        {item.answer.map((block, i) => {
          if (typeof block === "object" && "formula" in block) {
            return (
              <pre key={i} className="vz-code" style={{ marginTop: 10 }}>
                <LocalizedText text={block.formula} />
              </pre>
            );
          }
          return (
            <p key={i} className="max-w-[70ch] text-[15.5px] leading-[1.6]" style={{ color: INK2, marginTop: i === 0 ? 0 : 12, whiteSpace: "pre-line" }}>
              <LocalizedText text={block} />
            </p>
          );
        })}
        {item.refs.length > 0 && (
          <ol className="vz-refs" style={{ listStyle: "decimal", paddingLeft: 20 }}>
            {item.refs.map((ref, i) => (
              <li key={i}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer"><LocalizedText text={ref.label} /></a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function FAQPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="Frequently asked questions"
        title="Why Vancomyzer is built the way it is."
        lede="How the model uses kidney function and body weight, and what has and has not been validated. Each answer cites its sources."
        compact
      />
      <Record label="Questions" note={`${FAQ_ITEMS.length} answers. Open any question; the references are listed under each answer.`} last>
        <div className="vz-faq">
          {FAQ_ITEMS.map((item, index) => (
            <FaqEntry key={index} item={item} index={index} />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/calculator" className="vz-mbtn vz-mbtn--primary"><LocalizedText text="Open the calculator" /></Link>
          <Link href="/transparent-dosing" className="vz-mbtn vz-mbtn--outline"><LocalizedText text="Evidence and methods" /></Link>
        </div>
      </Record>
    </div>
  );
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}
