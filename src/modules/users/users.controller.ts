import {
  Controller, Get, Patch, Delete, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Role }) @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('role') role?: Role, @Query('search') search?: string,
  ) {
    return this.usersService.findAll({
      page: page ? +page : 1, limit: limit ? +limit : 20, role, search,
    });
  }

  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: { firstName?: string; lastName?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch(':id/block')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async blockUser(@Param('id') id: string) {
    return this.usersService.blockUser(id);
  }

  @Patch(':id/unblock')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async unblockUser(@Param('id') id: string) {
    return this.usersService.unblockUser(id);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async changeRole(@Param('id') id: string, @Body() dto: { role: Role }) {
    return this.usersService.changeRole(id, dto.role);
  }

  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async toggleActive(@Param('id') id: string, @Body() dto: { isActive: boolean }) {
    return this.usersService.toggleActive(id, dto.isActive);
  }

  @Delete(':id')
  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
