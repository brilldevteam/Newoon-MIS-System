import { IsString } from 'class-validator';

export class AddWorkflowCommentDto {
  @IsString()
  body!: string;
}
