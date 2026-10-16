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
import { LocalAgentTokenGuard } from './local-agent-token.guard';
import { LocalAgentTaskService } from './local-agent-task.service';
import {
  DtoLocalAgentTaskAction,
  DtoLocalAgentTaskQuery,
  DtoLocalAgentTaskReport,
} from './dto/local-agent-task.dto';

@Controller('tasks-agent')
@UseGuards(LocalAgentTokenGuard)
export class LocalAgentTasksController {
  constructor(private readonly localAgentTasks: LocalAgentTaskService) {}

  @Get()
  findQueue(@Query() query: DtoLocalAgentTaskQuery) {
    return this.localAgentTasks.findQueue(query.assigneeKind);
  }

  /** Возвращает в очередь задачи, брошенные после перезапуска ноутбука. */
  @Post('recover')
  recover(@Body() dto: DtoLocalAgentTaskAction) {
    return this.localAgentTasks.recoverStale(dto.assigneeKind);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskAction) {
    return this.localAgentTasks.claim(id, dto.assigneeKind);
  }

  @Patch(':id/note')
  note(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.localAgentTasks.note(id, dto.assigneeKind, dto.summary);
  }

  @Patch(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.localAgentTasks.heartbeat(id, dto.assigneeKind, dto.summary);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.localAgentTasks.complete(id, dto.assigneeKind, dto.summary);
  }

  @Patch(':id/fail')
  fail(@Param('id') id: string, @Body() dto: DtoLocalAgentTaskReport) {
    return this.localAgentTasks.fail(id, dto.assigneeKind, dto.summary);
  }
}
