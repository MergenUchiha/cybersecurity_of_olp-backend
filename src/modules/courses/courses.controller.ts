import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: { title: string; description?: string; category?: string },
  ) {
    return this.coursesService.create(userId, dto);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'category', required: false })
  async findAll(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('search') search?: string, @Query('category') category?: string,
  ) {
    return this.coursesService.findAll({
      page: page ? +page : 1, limit: limit ? +limit : 20,
      search, category, publishedOnly: true,
    });
  }

  @Get('my-courses')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async findMyCourses(@CurrentUser('sub') userId: string) {
    return this.coursesService.findByTeacher(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: { title?: string; description?: string; category?: string },
  ) {
    return this.coursesService.update(id, userId, role, dto);
  }

  @Patch(':id/toggle-publish')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async togglePublish(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.coursesService.togglePublish(id, userId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard) @Roles(Role.TEACHER, Role.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.coursesService.delete(id, userId, role);
  }
}
