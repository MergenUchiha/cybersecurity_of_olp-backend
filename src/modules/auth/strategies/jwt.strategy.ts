import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';
import { loadEnv } from '../../../config/env.validation';
import type { TokenPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // No fallback: the secret is validated at startup.
      secretOrKey: loadEnv().JWT_SECRET,
    });
  }

  async validate(payload: TokenPayload) {
    // Both tokens are signed with the same secret, so the claim is what keeps
    // a seven-day refresh token from being used as an access token.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Not an access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!user || !user.isActive || user.isBlocked) {
      throw new UnauthorizedException('User account is not active');
    }

    // Check if session was revoked
    if (payload.sid) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { isRevoked: true },
      });
      if (!session || session.isRevoked) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
