import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ComplianceClientQuery, ComplianceClientsService } from './compliance-clients.service';
import { AddRoleDto, AllocateStaffDto, CreatePersonDto, PassportDto, RemoveRecordDto, UpdateRecordFieldDto, UpdateRoleDto } from './dto/client-records.dto';
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

  // Expiring documents of all clients in the register as Excel (window: EXPIRED, 30, 60 or ALL).
  @Get('export/expiry')
  async exportExpiry(@CurrentUser() user: RequestUser, @Query('window') window: string | undefined, @Res() response: Response) {
    const file = await this.complianceClientsService.exportExpiry(user, null, window);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  }

  @Get(':id/expiry/export')
  async exportClientExpiry(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('window') window: string | undefined, @Res() response: Response) {
    const file = await this.complianceClientsService.exportExpiry(user, id, window);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
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

  // Client records (2026-11-22): the company and its people, each person with any number of roles. Every change is
  // audited; the approved KYC form is never changed. Writes need compliance Edit (RolesGuard).
  @Patch(':id/entity')
  updateEntityField(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateRecordFieldDto) {
    return this.complianceClientsService.updateEntityField(user, id, dto);
  }

  @Post(':id/people')
  addPerson(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreatePersonDto) {
    return this.complianceClientsService.addPerson(user, id, dto);
  }

  @Patch(':id/people/:personId')
  updatePersonField(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Body() dto: UpdateRecordFieldDto) {
    return this.complianceClientsService.updatePersonField(user, id, personId, dto);
  }

  @Post(':id/people/:personId/roles')
  addRole(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Body() dto: AddRoleDto) {
    return this.complianceClientsService.addRole(user, id, personId, dto);
  }

  @Patch(':id/people/:personId/roles/:roleId')
  updateRole(
    @CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Param('roleId') roleId: string, @Body() dto: UpdateRoleDto
  ) {
    return this.complianceClientsService.updateRole(user, id, personId, roleId, dto);
  }

  // Removing a person's last role removes the person from the tabs (kept, archived, with their documents).
  @Post(':id/people/:personId/roles/:roleId/remove')
  removeRole(
    @CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Param('roleId') roleId: string, @Body() dto: RemoveRecordDto
  ) {
    return this.complianceClientsService.removeRole(user, id, personId, roleId, dto);
  }

  @Post(':id/people/:personId/passports')
  addPassport(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Body() dto: PassportDto) {
    return this.complianceClientsService.addPassport(user, id, personId, dto);
  }

  @Patch(':id/people/:personId/passports/:passportId')
  updatePassport(
    @CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Param('passportId') passportId: string, @Body() dto: UpdateRecordFieldDto
  ) {
    return this.complianceClientsService.updatePassport(user, id, personId, passportId, dto);
  }

  @Post(':id/people/:personId/passports/:passportId/remove')
  removePassport(
    @CurrentUser() user: RequestUser, @Param('id') id: string, @Param('personId') personId: string, @Param('passportId') passportId: string, @Body() dto: RemoveRecordDto
  ) {
    return this.complianceClientsService.removePassport(user, id, personId, passportId, dto);
  }

  // Staff allocation (Accounting, HR see only allocated clients). Company Admin, AML Supervisor, DMLRO or MLRO.
  @Get(':id/allocations/candidates')
  allocationCandidates(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.complianceClientsService.allocationCandidates(user, id);
  }

  @Post(':id/allocations')
  allocate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AllocateStaffDto) {
    return this.complianceClientsService.allocate(user, id, dto.userId);
  }

  @Post(':id/allocations/:allocationId/remove')
  removeAllocation(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('allocationId') allocationId: string) {
    return this.complianceClientsService.removeAllocation(user, id, allocationId);
  }

  // Starts a periodic re-KYC prefilled from the current profile; earlier KYCs are kept as history.
  @Post(':id/rekyc')
  startRekyc(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.complianceClientsService.startRekyc(user, id);
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
