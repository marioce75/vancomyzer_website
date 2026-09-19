import type { MetadataRoute } from "next";

/** Public information pages only; never include account or patient-workflow URLs. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "", "/about", "/pricing", "/faq", "/contact", "/compliance",
    "/transparent-dosing", "/transparent-dosing/equations",
    "/transparent-dosing/cases", "/transparent-dosing/predictive-performance",
    "/transparent-dosing/engine-crosscheck", "/privacy", "/terms", "/disclaimer",
  ];
  return paths.map((path) => ({ url: `https://vancomyzer.com${path}` }));
}
