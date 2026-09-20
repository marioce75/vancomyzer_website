import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Login and reset-password expose noindex metadata; do not block its discovery.
      disallow: ["/api/", "/admin", "/research", "/settings", "/register", "/mfa-verify", "/upgrade", "/calculator"],
    },
    sitemap: "https://vancomyzer.com/sitemap.xml",
  };
}
