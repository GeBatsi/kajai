import { requireCorrectionSession } from '@/lib/correction-route'

export const dynamic = 'force-dynamic'

export default async function RecipeBookLayout({ children }: { children: React.ReactNode }) {
  await requireCorrectionSession()
  return <>{children}</>
}
