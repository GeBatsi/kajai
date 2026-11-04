import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { AppThemeToggle } from '@/components/theme/app-theme-toggle'
import '@kajai/ui/tokens.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'KajAI',
  description: 'AI-powered nutrition & fitness tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: a next-themes még hydration előtt ráteszi a `.dark` osztályt a <html>-re.
    <html lang="hu" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <AppThemeToggle className="fixed bottom-4 right-4 z-40" />
        </Providers>
      </body>
    </html>
  )
}
