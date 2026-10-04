import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AiAssistantMessage, AiReviewService } from './ai-review.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiReviewService: AiReviewService) {}

  @Roles('OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN')
  @Post('assistant')
  assistant(@CurrentUser() user: RequestUser, @Body() body: { messages?: AiAssistantMessage[]; currentPath?: string }) {
    return this.aiReviewService.answerApplicationQuestion(user, body.messages || [], body.currentPath || '/');
  }
}
