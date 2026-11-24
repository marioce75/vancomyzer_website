import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isStudyDemoOwner } from "@/lib/studyDemo/requireOwner";
import { FICTIONAL_CASES } from "@/lib/studyTimed/fictionalCases";
import StudyDemoWorkspace from "./workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Study demo", robots: { index: false, follow: false } };

/** Owner-only. Every other visitor gets the standard 404, decided on the server. */
export default async function StudyDemoPage() {
  if (!(await isStudyDemoOwner())) notFound();
  return <StudyDemoWorkspace cases={FICTIONAL_CASES} />;
}
