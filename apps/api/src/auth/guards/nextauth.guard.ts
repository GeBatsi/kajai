import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { jwtDecrypt } from 'jose'

async function getDerivedKey(secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('NextAuth.js Generated Encryption Key'),
    },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

@Injectable()
export class NextAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const token: string | undefined = req.cookies?.['kajai-session']
    if (!token) return false

    try {
      const key = await getDerivedKey(process.env.NEXTAUTH_SECRET!)
      const { payload } = await jwtDecrypt(token, key, { clockTolerance: 15 })
      if (!payload.userId) return false
      req.user = { id: payload.userId, role: payload.role }
      return true
    } catch {
      return false
    }
  }
}
