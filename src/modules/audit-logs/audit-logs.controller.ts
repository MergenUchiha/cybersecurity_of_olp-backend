import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false }) @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startDate', required: false }) @ApiQuery({ name: 'endDate', required: false })
  async findAll(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('action') action?: string, @Query('userId') userId?: string,
    @Query('startDate') startDate?: string, @Query('endDate') endDate?: string,
  ) {
    return this.auditLogsService.findAll({
      page: page ? +page : 1, limit: limit ? +limit : 20, action, userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
