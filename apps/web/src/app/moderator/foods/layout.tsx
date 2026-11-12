import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getAuthOptions } from '@/lib/auth'
import { canManageFoods } from '@/lib/food-permissions'

export default async function FoodManagementLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(await getAuthOptions())

  if (!session?.user.id) redirect('/login')
  if (!canManageFoods(session.user.role)) redirect('/')

  return <>{children}</>
}
