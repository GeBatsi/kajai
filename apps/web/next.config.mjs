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
    ],
  },
}

export default nextConfig