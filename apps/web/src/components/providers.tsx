'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CorrectionPrivacyGuard } from '@/components/nutrition-corrections/shared'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    // A `.dark` osztályt a <html>-re teszi; alapból a rendszer beállítását követi.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}><CorrectionPrivacyGuard />{children}</QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
