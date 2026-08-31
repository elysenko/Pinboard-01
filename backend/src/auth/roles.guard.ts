import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from './jwt-payload';
import { ROLES_KEY } from './roles.decorator';

/**
 * Runs after JwtAuthGuard. Distinguishes "not signed in" (401) from
 * "signed in without the required role" (403) so the frontend interceptor can
 * redirect on 401 without bouncing an ordinary user who simply lacks access.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
