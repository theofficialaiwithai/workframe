/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Vercel only bundles files it can trace statically. Lessons and the two
    // governance documents are read with fs at request time, so they are
    // listed here or they would be missing in production.
    outputFileTracingIncludes: {
      "/learn/[course]/[lesson]": ["./content/**/*"],
      "/dashboard": ["./content/**/*"],
      "/api/webhooks/stripe": ["./content/**/*"],
      "/admin/docs/[name]": ["./docs/**/*"],
    },
  },
};

export default nextConfig;
