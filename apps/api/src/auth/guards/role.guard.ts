import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@kajai/db';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../types/request-user.type';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';
import { hasMinRole, RegisteredRole } from '../role-hierarchy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    const minimum = this.reflector.getAllAndOverride<RegisteredRole>(MIN_ROLE_KEY, [
      context.getHandler(), context.getClass(),
    ]);

    if ((!requiredRoles || requiredRoles.length === 0) && !minimum) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User context missing.');
    }

    // If both decorators are present, both constraints must hold.
    if (
      (requiredRoles?.length && !requiredRoles.includes(user.role)) ||
      (minimum && !hasMinRole(user.role, minimum))
    ) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return true;
  }
}
