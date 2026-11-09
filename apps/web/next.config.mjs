/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kajai/ui', '@kajai/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-91ce0923067346d0b5a60b82b629308b.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
