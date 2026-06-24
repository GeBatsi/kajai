import { Injectable } from '@nestjs/common'

export interface AuthUser {
  id: string
  role: string
}

@Injectable()
export class AuthService {}
