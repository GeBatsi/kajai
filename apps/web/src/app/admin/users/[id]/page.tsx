import { AdminUserDetail } from '@/components/admin/admin-user-detail'

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminUserDetail id={id} />
}
