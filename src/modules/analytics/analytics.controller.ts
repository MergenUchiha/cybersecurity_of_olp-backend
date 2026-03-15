import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.analyticsService.getDashboardMetrics();
  }

  @Get('failed-logins')
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getFailedLogins(@Query('days') days?: string) {
    return this.analyticsService.getFailedLoginsOverTime(days ? +days : 7);
  }

  @Get('events-by-type')
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getEventsByType(@Query('days') days?: string) {
    return this.analyticsService.getEventsByType(days ? +days : 30);
  }

  @Get('events-by-role')
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getEventsByRole(@Query('days') days?: string) {
    return this.analyticsService.getEventsByRole(days ? +days : 30);
  }

  @Get('user-stats')
  async getUserStats() {
    return this.analyticsService.getUserStats();
  }

  @Get('blocking-stats')
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getBlockingStats(@Query('days') days?: string) {
    return this.analyticsService.getBlockingStats(days ? +days : 30);
  }
}
