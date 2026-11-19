import { Role } from '@kajai/db'
import { IsEnum, IsIn } from 'class-validator'
import { REGISTERED_ROLES, type RegisteredRole } from '../../auth/role-hierarchy'

export class UpdateUserRoleDto {
  @IsEnum(Role)
  @IsIn(REGISTERED_ROLES)
  role!: RegisteredRole
}
