/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@agent-breach/trace-schema", "@agent-breach/detectors"],
};

export default nextConfig;
