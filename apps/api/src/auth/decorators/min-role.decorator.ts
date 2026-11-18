import { SetMetadata } from '@nestjs/common'
import { RegisteredRole } from '../role-hierarchy'

export const MIN_ROLE_KEY = 'minRole'
export const MinRole = (role: RegisteredRole) => SetMetadata(MIN_ROLE_KEY, role)
