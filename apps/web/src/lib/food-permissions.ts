export function canManageFoods(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MODERATOR'
}
