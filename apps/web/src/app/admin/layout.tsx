import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getAuthOptions } from '@/lib/auth'
import { canAccessAdmin } from '@/lib/admin-permissions'
import { AdminShell } from '@/components/admin/admin-shell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user.id || session.user.isBanned) redirect('/login')
  if (!canAccessAdmin(session.user)) redirect('/')
  return <AdminShell>{children}</AdminShell>
}
