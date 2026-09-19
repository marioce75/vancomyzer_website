import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/research", "/settings", "/login", "/register", "/reset-password", "/mfa-verify", "/upgrade", "/calculator"],
    },
    sitemap: "https://vancomyzer.com/sitemap.xml",
  };
}
