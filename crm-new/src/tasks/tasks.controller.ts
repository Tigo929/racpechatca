import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { DtoCreateTask } from './dto/create-task.dto';
import { DtoUpdateTask, DtoUpdateTaskStatus } from './dto/update-task.dto';
import { DtoQueryTasks } from './dto/query-tasks.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { EnumRole } from 'src/generated/prisma/enums';

interface RequestUser {
  id: string;
  role: EnumRole;
}

/**
 * Задачи ставит администратор. Исполнитель видит только свои и может лишь
 * двигать их статус — поэтому права размечены по методам, а не на классе.
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: DtoCreateTask, @CurrentUser() me: RequestUser) {
    return this.tasksService.create(dto, me.id);
  }

  @Get()
  @Roles(EnumRole.ADMIN, EnumRole.EXECUTOR)
  findAll(@Query() query: DtoQueryTasks, @CurrentUser() me: RequestUser) {
    return this.tasksService.findAll(query, me.id, me.role);
  }

  @Get('count')
  @Roles(EnumRole.ADMIN, EnumRole.EXECUTOR)
  countOpen(@CurrentUser() me: RequestUser) {
    return this.tasksService.countOpen(me.id, me.role);
  }

  @Get(':id')
  @Roles(EnumRole.ADMIN, EnumRole.EXECUTOR)
  findOne(@Param('id') id: string, @CurrentUser() me: RequestUser) {
    return this.tasksService.findOne(id, me.id, me.role);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: DtoUpdateTask) {
    return this.tasksService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(EnumRole.ADMIN, EnumRole.EXECUTOR)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: DtoUpdateTaskStatus,
    @CurrentUser() me: RequestUser,
  ) {
    return this.tasksService.updateStatus(id, dto.status, me.id, me.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
