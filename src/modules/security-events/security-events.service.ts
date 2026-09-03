import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SecurityEventType } from '../../common/constants';
import { Prisma } from '@prisma/client';

export interface SecurityEventData {
  eventType: SecurityEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: SecurityEventData) {
    try {
      await this.prisma.securityEvent.create({
        data: {
          eventType: data.eventType,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          details: data.details ? JSON.stringify(data.details) : undefined,
        },
      });
      this.logger.log(
        `Security event: ${data.eventType} | user: ${data.userId || 'anonymous'} | ip: ${data.ipAddress || 'unknown'}`,
      );
    } catch (error) {
      this.logger.error('Failed to log security event', error);
    }
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    eventType?: SecurityEventType;
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      page = 1,
      limit = 20,
      eventType,
      userId,
      ipAddress,
      startDate,
      endDate,
    } = params;

    const where: Prisma.SecurityEventWhereInput = {};
    if (eventType) where.eventType = eventType;
    if (userId) where.userId = userId;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = startDate;
      if (endDate) where.occurredAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.securityEvent.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentEvents(limit = 10) {
    return this.prisma.securityEvent.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  async getFailedLoginCount(minutes = 60) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.securityEvent.count({
      where: {
        eventType: 'LOGIN_FAILURE',
        occurredAt: { gte: since },
      },
    });
  }

  async getUserFailedLogins(userId: string, minutes = 15) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.securityEvent.count({
      where: {
        eventType: 'LOGIN_FAILURE',
        userId,
        occurredAt: { gte: since },
      },
    });
  }

  async getIpFailedLogins(ipAddress: string, minutes = 15) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.securityEvent.count({
      where: {
        eventType: 'LOGIN_FAILURE',
        ipAddress,
        occurredAt: { gte: since },
      },
    });
  }
}
