import { Role } from '@kajai/db'

export type RegisteredRole = Exclude<Role, 'GUEST'>

const ROLE_RANK = {
  [Role.GUEST]: 0,
  [Role.USER]: 1,
  [Role.MODERATOR]: 2,
  [Role.ADMIN]: 3,
} as const satisfies Record<Role, number>

export function hasMinRole(role: Role, minimum: RegisteredRole): boolean {
  return (
    role !== Role.GUEST &&
    Object.hasOwn(ROLE_RANK, role) &&
    Object.hasOwn(ROLE_RANK, minimum) &&
    ROLE_RANK[role] >= ROLE_RANK[minimum]
  )
}
