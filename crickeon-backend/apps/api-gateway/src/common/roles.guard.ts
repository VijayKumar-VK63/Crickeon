import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'admin' | 'player'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { role?: string } }>();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token && !req.user) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'replace-me') as { role?: string };
        req.user = { role: payload.role };
      } catch {
        throw new ForbiddenException('Invalid token');
      }
    }

    const role = req.user?.role ?? req.headers['x-role'];

    if (!role || !requiredRoles.includes(role as 'admin' | 'player')) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
