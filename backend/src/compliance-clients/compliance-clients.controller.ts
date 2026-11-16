import { Body, Controller, Get, Param, Patch, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ComplianceClientQuery, ComplianceClientsService } from './compliance-clients.service';
import { UpdateComplianceClientDto } from './dto/update-compliance-client.dto';

// Access follows the "compliance" area of the role matrix (see RolesGuard): GET needs view, PATCH needs edit.
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('compliance/clients')
export class ComplianceClientsController {
  constructor(private readonly complianceClientsService: ComplianceClientsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ComplianceClientQuery) {
    return this.complianceClientsService.list(user, this.pickQuery(query));
  }

  @Get('export/excel')
  async exportExcel(@CurrentUser() user: RequestUser, @Query() query: ComplianceClientQuery, @Res() response: Response) {
    const file = await this.complianceClientsService.exportExcel(user, this.pickQuery(query));
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('X-Export-Truncated', file.truncated ? 'true' : 'false');
    response.send(file.content);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.complianceClientsService.findOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateComplianceClientDto) {
    return this.complianceClientsService.update(user, id, dto);
  }

  private pickQuery(query: Record<string, unknown>): ComplianceClientQuery {
    const text = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
    return {
      search: text('search'),
      status: text('status'),
      riskLevel: text('riskLevel'),
      cddType: text('cddType'),
      jurisdiction: text('jurisdiction'),
      review: text('review'),
      attention: text('attention'),
      page: text('page'),
      pageSize: text('pageSize')
    };
  }
}
