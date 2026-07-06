import { ProposalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateProposalStatusDto {
  @IsEnum(ProposalStatus)
  proposalStatus!: ProposalStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
