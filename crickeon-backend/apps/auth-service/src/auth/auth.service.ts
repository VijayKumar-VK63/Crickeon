import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@crickeon/shared-contracts';
import { LoginDto, RefreshTokenDto, RegisterDto } from './auth.dto';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';

@Injectable()
export class AuthService {
  private readonly redis = RedisClientFactory.createClient();

  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        displayName: input.displayName,
        role: 'player'
      }
    });

    return this.issueTokens({
      id: user.id,
      email: input.email.toLowerCase(),
      displayName: user.displayName,
      role: user.role as UserRole
    });
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserRole
    });
  }

  async refresh(input: RefreshTokenDto) {
    let payload: { sub: string; email: string; role: UserRole };
    try {
      payload = jwt.verify(input.refreshToken, process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'replace-me') as {
        sub: string;
        email: string;
        role: UserRole;
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.redis.get(`auth:refresh:${payload.sub}`);
    if (!stored || stored !== input.refreshToken) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserRole
    });
  }

  private async issueTokens(user: { id: string; email: string; displayName: string; role: UserRole }) {
    const sub = { sub: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(sub, process.env.JWT_SECRET ?? 'replace-me', { expiresIn: '15m' });
    const refreshToken = jwt.sign(sub, process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'replace-me', {
      expiresIn: '7d'
    });

    await this.redis.set(`auth:refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
  }
}
