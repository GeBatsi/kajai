export function canAccessAdmin(user: { id?: string; role?: string; isBanned?: boolean } | null | undefined): boolean {
  return !!user?.id?.trim() && user.role === 'ADMIN' && user.isBanned !== true
}
