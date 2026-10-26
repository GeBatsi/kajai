import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hkdfSync } from 'node:crypto'
import { jwtDecrypt } from 'jose'
import { PrismaService } from '../../prisma/prisma.service'
import { RequestWithUser } from '../types/request-user.type'

@Injectable()
export class NextAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>()
    delete request.user
    const token = this.sessionToken(request.cookies)
    if (!token) throw new UnauthorizedException('Bejelentkezés szükséges.')

    const secret = this.config.get<string>('NEXTAUTH_SECRET')
    if (!secret) {
      throw new InternalServerErrorException('A hitelesítés nincs megfelelően beállítva.')
    }

    let userId: string
    try {
      // NextAuth v4's default encrypted session format; covered by a real encoder test.
      const key = new Uint8Array(
        hkdfSync('sha256', secret, '', 'NextAuth.js Generated Encryption Key', 32),
      )
      const { payload } = await jwtDecrypt(token, key, {
        clockTolerance: 15,
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
        requiredClaims: ['userId', 'iat', 'exp'],
      })
      if (typeof payload.userId !== 'string' || !payload.userId.trim()) {
        throw new Error('Invalid session subject')
      }
      userId = payload.userId
    } catch {
      throw new UnauthorizedException('Érvénytelen vagy lejárt munkamenet.')
    }

    this.checkOrigin(request)

    // Never trust the role in the token or client headers: changes apply on the next request.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) throw new UnauthorizedException('A munkamenet felhasználója nem található.')

    request.user = { id: user.id, role: user.role }
    return true
  }

  private sessionToken(cookies: unknown): string | null {
    if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) return null
    const values = cookies as Record<string, unknown>
    const chunks = Object.keys(values).filter((name) => name.startsWith('kajai-session.'))
    if (values['kajai-session'] !== undefined) {
      return chunks.length === 0 && typeof values['kajai-session'] === 'string'
        ? values['kajai-session'] || null
        : null
    }

    // NextAuth splits large session cookies into .0, .1, ...; reject incomplete sequences.
    chunks.sort((left, right) => Number(left.split('.').pop()) - Number(right.split('.').pop()))
    if (
      chunks.length === 0 ||
      chunks.some(
        (name, index) =>
          name !== `kajai-session.${index}` || typeof values[name] !== 'string' || !values[name],
      )
    )
      return null

    return chunks.map((name) => values[name]).join('')
  }

  private checkOrigin(request: RequestWithUser): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return

    let trustedOrigin: string
    try {
      trustedOrigin = new URL(this.config.get<string>('NEXTAUTH_URL') ?? 'http://localhost:4000')
        .origin
    } catch {
      throw new InternalServerErrorException('A hitelesítés nincs megfelelően beállítva.')
    }
    if (request.headers.origin !== trustedOrigin) {
      throw new ForbiddenException('A kérés eredete nem engedélyezett.')
    }
  }
}
