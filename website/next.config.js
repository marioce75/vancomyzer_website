/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // /references → /transparent-dosing. The "References & Methods" page
      // was replaced by the Transparent Dosing manifesto. 308 (permanent)
      // preserves SEO juice and forwards old bookmarks / email signatures.
      { source: "/references", destination: "/transparent-dosing", permanent: true },
    ];
  },
};
module.exports = nextConfig;
