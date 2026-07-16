import { Module } from '@nestjs/common';
import { CoolabcService } from './coolabc.service';

@Module({
  providers: [CoolabcService],
  exports: [CoolabcService],
})
export class CoolabcModule {}
