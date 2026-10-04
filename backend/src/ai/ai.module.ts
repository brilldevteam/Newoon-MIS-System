import { Module } from '@nestjs/common';
import { AiReviewService } from './ai-review.service';
import { AiController } from './ai.controller';

@Module({
  providers: [AiReviewService],
  controllers: [AiController],
  exports: [AiReviewService]
})
export class AiModule {}
