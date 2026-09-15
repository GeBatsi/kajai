import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'KajAI',
  description: 'AI-powered nutrition & fitness tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
