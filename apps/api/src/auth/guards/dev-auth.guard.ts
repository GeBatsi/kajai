import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@kajai/db';
import { RequestWithUser } from '../types/request-user.type';

const VALID_ROLES: readonly Role[] = [
  'GUEST',
  'USER',
  'MODERATOR',
  'ADMIN',
];

@Injectable()
export class DevAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const roleHeader = request.headers['x-user-role'];
    const userIdHeader = request.headers['x-user-id'];

    if (!roleHeader || Array.isArray(roleHeader)) {
      throw new UnauthorizedException('Missing x-user-role header.');
    }

    if (!userIdHeader || Array.isArray(userIdHeader)) {
      throw new UnauthorizedException('Missing x-user-id header.');
    }

    const normalizedRole = roleHeader.toUpperCase();

    if (!VALID_ROLES.includes(normalizedRole as Role)) {
      throw new UnauthorizedException('Invalid x-user-role header.');
    }

    request.user = {
      id: userIdHeader,
      role: normalizedRole as Role,
    };

    return true;
  }
}
