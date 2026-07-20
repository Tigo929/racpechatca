import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskReminderService } from './task-reminder.service';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [TasksController],
  providers: [TasksService, TaskReminderService],
  exports: [TasksService],
})
export class TasksModule {}
