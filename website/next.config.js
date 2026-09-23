/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { instrumentationHook: true },
  async redirects() {
    return [
      // Browsers and crawlers may request the conventional icon path directly.
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: true },
      // /references → /transparent-dosing. The "References & Methods" page
      // was replaced by the Transparent Dosing manifesto. 308 (permanent)
      // preserves SEO juice and forwards old bookmarks / email signatures.
      { source: "/references", destination: "/transparent-dosing", permanent: true },
    ];
  },
};
module.exports = nextConfig;
