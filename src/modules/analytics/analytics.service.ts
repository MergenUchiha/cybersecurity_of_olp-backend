import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      activeSessions,
      failedLogins24h,
      failedLogins7d,
      totalSecurityEvents24h,
      blockedUsers,
      recentSecurityEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.course.count(),
      this.prisma.enrollment.count(),
      this.prisma.session.count({ where: { isRevoked: false, expiresAt: { gt: now } } }),
      this.prisma.securityEvent.count({ where: { eventType: 'LOGIN_FAILURE', occurredAt: { gte: last24h } } }),
      this.prisma.securityEvent.count({ where: { eventType: 'LOGIN_FAILURE', occurredAt: { gte: last7d } } }),
      this.prisma.securityEvent.count({ where: { occurredAt: { gte: last24h } } }),
      this.prisma.user.count({ where: { isBlocked: true } }),
      this.prisma.securityEvent.findMany({
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      overview: { totalUsers, totalCourses, totalEnrollments, activeSessions, blockedUsers },
      security: { failedLogins24h, failedLogins7d, totalSecurityEvents24h },
      recentSecurityEvents,
    };
  }

  async getFailedLoginsOverTime(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.securityEvent.findMany({
      where: { eventType: 'LOGIN_FAILURE', occurredAt: { gte: since } },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    });

    // Group by date
    const grouped: Record<string, number> = {};
    for (const event of events) {
      const date = event.occurredAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    }

    // Fill in missing dates
    const result: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      result.push({ date: dateStr, count: grouped[dateStr] || 0 });
    }

    return result;
  }

  async getEventsByType(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.securityEvent.groupBy({
      by: ['eventType'],
      where: { occurredAt: { gte: since } },
      _count: { id: true },
    });

    return events.map(e => ({
      eventType: e.eventType,
      count: e._count.id,
    }));
  }

  async getEventsByRole(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();
    const events = await this.prisma.$queryRawUnsafe(
      `SELECT u.role, CAST(COUNT(se.id) AS INTEGER) as count
       FROM security_events se
       LEFT JOIN users u ON se.userId = u.id
       WHERE se.occurredAt >= ?
       GROUP BY u.role`,
      sinceIso,
    ) as any[];

    return events;
  }

  async getUserStats() {
    const users = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    return users.map(u => ({
      role: u.role,
      count: u._count.id,
    }));
  }

  async getBlockingStats(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [blocked, bruteForce, rateLimited] = await Promise.all([
      this.prisma.securityEvent.count({
        where: { eventType: 'ACCOUNT_BLOCKED', occurredAt: { gte: since } },
      }),
      this.prisma.securityEvent.count({
        where: { eventType: 'BRUTE_FORCE_DETECTED', occurredAt: { gte: since } },
      }),
      this.prisma.securityEvent.count({
        where: { eventType: 'RATE_LIMIT_TRIGGERED', occurredAt: { gte: since } },
      }),
    ]);

    return { blocked, bruteForce, rateLimited };
  }
}
