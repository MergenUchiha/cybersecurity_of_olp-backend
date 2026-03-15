import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { SecurityEventsController } from './security-events.controller';

@Module({
  providers: [SecurityEventsService],
  controllers: [SecurityEventsController],
  exports: [SecurityEventsService],
})
export class SecurityEventsModule {}
