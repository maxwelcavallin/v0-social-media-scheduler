/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["bcryptjs"],
  cleanDistDir: true,
  experimental: {
    turbo: {
      memoryLimit: 512,
    },
  },
}

export default nextConfig
