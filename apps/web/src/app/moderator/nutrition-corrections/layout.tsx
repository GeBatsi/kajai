import { requireCorrectionSession } from '@/lib/correction-route'
import { CorrectionShell } from '@/components/nutrition-corrections/shared'
export const dynamic='force-dynamic'
export default async function Layout({children}:{children:React.ReactNode}){await requireCorrectionSession(true);return <CorrectionShell moderator={true}>{children}</CorrectionShell>}