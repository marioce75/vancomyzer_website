import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isStudyDemoOwner } from "@/lib/studyDemo/requireOwner";
import { Suspense } from "react";
import CalculatorWorkspace from "@/components/calculator/CalculatorWorkspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Study demo", robots: { index: false, follow: false } };

/** Owner-only. Every other visitor gets the standard 404, decided on the server. */
export default async function StudyDemoPage() {
  if (!(await isStudyDemoOwner())) notFound();
  return <Suspense fallback={null}><CalculatorWorkspace ownerManualDemo /></Suspense>;
}
