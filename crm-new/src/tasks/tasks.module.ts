import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskReminderService } from './task-reminder.service';
import { TelegramModule } from 'src/telegram/telegram.module';
import { LocalAgentTasksController } from './local-agent-tasks.controller';
import { LocalAgentTokenGuard } from './local-agent-token.guard';

@Module({
  imports: [TelegramModule],
  controllers: [LocalAgentTasksController, TasksController],
  providers: [TasksService, TaskReminderService, LocalAgentTokenGuard],
  exports: [TasksService],
})
export class TasksModule {}
