import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { LocalAgentTokenGuard } from './local-agent-token.guard';
import {
  DtoLocalAgentTaskAction,
  DtoLocalAgentTaskQuery,
  DtoLocalAgentTaskReport,
} from './dto/local-agent-task.dto';

@Controller('tasks-agent')
@UseGuards(LocalAgentTokenGuard)
export class LocalAgentTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findQueue(@Query() query: DtoLocalAgentTaskQuery) {
    return this.tasksService.findLocalAgentQueue(query.assigneeKind);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskAction) {
    return this.tasksService.claimLocalAgentTask(id, dto.assigneeKind);
  }

  @Patch(':id/note')
  note(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.tasksService.noteLocalAgentTask(id, dto.assigneeKind, dto.summary);
  }

  @Patch(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.tasksService.heartbeatLocalAgentTask(
      id,
      dto.assigneeKind,
      dto.summary,
    );
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.tasksService.completeLocalAgentTask(
      id,
      dto.assigneeKind,
      dto.summary,
    );
  }

  @Patch(':id/fail')
  fail(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.tasksService.failLocalAgentTask(id, dto.assigneeKind, dto.summary);
  }
}
