/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module; keep it external so Next does not try to
  // bundle its .node binary into the server build.
  serverExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;
