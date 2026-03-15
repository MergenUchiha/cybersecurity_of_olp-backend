import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('my-sessions')
  async getMySessions(@CurrentUser('sub') userId: string) {
    return this.sessionsService.findByUser(userId);
  }

  @Get()
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.sessionsService.findAll({ page: page ? +page : 1, limit: limit ? +limit : 20 });
  }

  @Patch(':id/revoke')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async revokeSession(@Param('id') id: string) {
    return this.sessionsService.revokeSession(id);
  }

  @Patch('user/:userId/revoke-all')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async revokeAllUserSessions(@Param('userId') userId: string) {
    return this.sessionsService.revokeAllUserSessions(userId);
  }
}
