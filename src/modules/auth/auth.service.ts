import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '../../common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private securityEventsService: SecurityEventsService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.STUDENT,
      },
    });

    // Create email verification token
    const verificationToken = uuidv4();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    return {
      message: 'Registration successful',
      userId: user.id,
    };
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Check for brute force by IP
    const ipFailedLogins = ipAddress
      ? await this.securityEventsService.getIpFailedLogins(ipAddress, 15)
      : 0;

    if (ipFailedLogins >= 10) {
      await this.securityEventsService.log({
        eventType: 'BRUTE_FORCE_DETECTED',
        ipAddress,
        userAgent,
        details: { reason: 'Too many failed logins from this IP', count: ipFailedLogins },
      });
      throw new ForbiddenException(
        'Too many failed login attempts. Please try again later.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await this.securityEventsService.log({
        eventType: 'LOGIN_FAILURE',
        ipAddress,
        userAgent,
        details: { reason: 'User not found', email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check for user-specific brute force
    const userFailedLogins = await this.securityEventsService.getUserFailedLogins(user.id, 15);
    if (userFailedLogins >= 5) {
      await this.securityEventsService.log({
        eventType: 'BRUTE_FORCE_DETECTED',
        userId: user.id,
        ipAddress,
        userAgent,
        details: { reason: 'Too many failed logins for this user', count: userFailedLogins },
      });
      throw new ForbiddenException(
        'Account temporarily locked due to too many failed login attempts.',
      );
    }

    if (user.isBlocked) {
      await this.securityEventsService.log({
        eventType: 'LOGIN_FAILURE',
        userId: user.id,
        ipAddress,
        userAgent,
        details: { reason: 'Account is blocked' },
      });
      throw new ForbiddenException('Account is blocked. Contact administrator.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.securityEventsService.log({
        eventType: 'LOGIN_FAILURE',
        userId: user.id,
        ipAddress,
        userAgent,
        details: { reason: 'Invalid password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store session with hashed refresh token
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: hashedRefreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await this.securityEventsService.log({
      eventType: 'LOGIN_SUCCESS',
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Find all active sessions and check against hashed tokens
    const sessions = await this.prisma.session.findMany({
      where: { isRevoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    let matchedSession: any = null;
    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      await this.securityEventsService.log({
        eventType: 'SUSPICIOUS_REQUEST',
        ipAddress,
        userAgent,
        details: { reason: 'Invalid refresh token' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { isRevoked: true },
    });

    const user = matchedSession.user;
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create new session
    const hashedNewRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: hashedNewRefreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.securityEventsService.log({
      eventType: 'REFRESH_TOKEN',
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Find and revoke the session
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false },
    });

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);
      if (isMatch) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { isRevoked: true },
        });
        break;
      }
    }

    await this.securityEventsService.log({
      eventType: 'LOGOUT',
      userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all sessions except the current one
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    await this.securityEventsService.log({
      eventType: 'PASSWORD_CHANGE',
      userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Password changed successfully' };
  }

  async requestPasswordReset(email: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      return { message: 'If the email exists, a reset link will be sent' };
    }

    const token = uuidv4();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await this.securityEventsService.log({
      eventType: 'PASSWORD_RESET_REQUEST',
      userId: user.id,
      ipAddress,
      details: { token }, // In production, send via email instead
    });

    return { message: 'If the email exists, a reset link will be sent', token };
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Revoke all sessions
    await this.prisma.session.updateMany({
      where: { userId: resetToken.userId },
      data: { isRevoked: true },
    });

    await this.securityEventsService.log({
      eventType: 'PASSWORD_RESET_COMPLETE',
      userId: resetToken.userId,
      ipAddress,
    });

    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(token: string) {
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.used || verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    await this.prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    });

    await this.securityEventsService.log({
      eventType: 'EMAIL_VERIFICATION',
      userId: verificationToken.userId,
    });

    return { message: 'Email verified successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
