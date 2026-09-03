import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditAction } from '../../common/constants';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    action: AuditAction;
    userId?: string;
    targetEntity?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    // SQLite has no JSON column, so the details are stored as text.
    return this.prisma.auditLog.create({
      data: {
        ...data,
        details: data.details ? JSON.stringify(data.details) : undefined,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { page = 1, limit = 20, action, userId, startDate, endDate } = params;
    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
