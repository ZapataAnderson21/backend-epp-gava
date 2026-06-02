import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RegisterProjectReturnDto } from './dto/register-project-return.dto';
import { RegisterOfficeEntryDto } from './dto/register-office-entry.dto';
import { RegisterDisposalDto } from './dto/register-disposal.dto';
import { RegisterMaintenanceDto } from './dto/register-maintenance.dto';
import { RegisterAdjustmentDto } from './dto/register-adjustment.dto';
import { RegisterTransferDto } from './dto/register-transfer.dto';
import { FindMovementsQueryDto } from './dto/find-movements-query.dto';
import { RegisterWorkerAssignmentDto } from './dto/register-worker-assignment.dto';
import { RegisterWorkerAssignmentsDto } from './dto/register-worker-assignments.dto';
import { UserTypes } from 'src/decorators/user-types.decorator';

const INVENTORY_ADMIN_ROLES = [
  'GERENTE',
  'ADMINISTRADOR',
  'ADMINISTRADORA',
  'LOGISTICA',
  'PREVENCIONISTA DE RIESGOS',
  'SISTEMAS',
] as const;

const PROJECT_INVENTORY_MANAGER_ROLES = [
  ...INVENTORY_ADMIN_ROLES,
  'PREVENCIONISTA DE RIESGOS',
] as const;

const PROJECT_ASSIGNMENT_ROLES = [
  'GERENTE',
  'ADMINISTRADORA',
  'SISTEMAS',
  'PREVENCIONISTA DE RIESGOS',
] as const;

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Office Inventory ────────────────────────────────────────

  @Get('office')
  async findOfficeInventory() {
    return await this.inventoryService.findOfficeInventory();
  }

  @Get('office/:officeInventoryEntryId')
  async findOfficeInventoryEntry(
    @Param('officeInventoryEntryId', ParseIntPipe)
    officeInventoryEntryId: number,
  ) {
    return await this.inventoryService.findOfficeInventoryEntry(
      officeInventoryEntryId,
    );
  }

  @Get('dashboard')
  async findDashboard(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return await this.inventoryService.findDashboard({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Post('office/entry')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerOfficeEntry(
    @Body() registerOfficeEntryDto: RegisterOfficeEntryDto,
  ) {
    return await this.inventoryService.registerOfficeEntry(
      registerOfficeEntryDto,
    );
  }

  @Post('office/:officeInventoryEntryId/dispose')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerOfficeDisposal(
    @Param('officeInventoryEntryId', ParseIntPipe)
    officeInventoryEntryId: number,
    @Body() registerDisposalDto: RegisterDisposalDto,
  ) {
    return await this.inventoryService.registerOfficeDisposal(
      officeInventoryEntryId,
      registerDisposalDto,
    );
  }

  @Post('office/:officeInventoryEntryId/maintenance-out')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerMaintenanceOut(
    @Param('officeInventoryEntryId', ParseIntPipe)
    officeInventoryEntryId: number,
    @Body() registerMaintenanceDto: RegisterMaintenanceDto,
  ) {
    return await this.inventoryService.registerMaintenanceOut(
      officeInventoryEntryId,
      registerMaintenanceDto,
    );
  }

  @Post('office/:officeInventoryEntryId/maintenance-return')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerMaintenanceReturn(
    @Param('officeInventoryEntryId', ParseIntPipe)
    officeInventoryEntryId: number,
    @Body() registerMaintenanceDto: RegisterMaintenanceDto,
  ) {
    return await this.inventoryService.registerMaintenanceReturn(
      officeInventoryEntryId,
      registerMaintenanceDto,
    );
  }

  @Post('office/:officeInventoryEntryId/adjust')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerOfficeAdjustment(
    @Param('officeInventoryEntryId', ParseIntPipe)
    officeInventoryEntryId: number,
    @Body() registerAdjustmentDto: RegisterAdjustmentDto,
  ) {
    return await this.inventoryService.registerOfficeAdjustment(
      officeInventoryEntryId,
      registerAdjustmentDto,
    );
  }

  // ─── Transfer Between Projects ───────────────────────────────

  @Post('project-entry/:projectInventoryEntryId/transfer')
  @UserTypes(...INVENTORY_ADMIN_ROLES)
  async registerTransferBetweenProjects(
    @Param('projectInventoryEntryId', ParseIntPipe)
    projectInventoryEntryId: number,
    @Body() registerTransferDto: RegisterTransferDto,
  ) {
    return await this.inventoryService.registerTransferBetweenProjects(
      projectInventoryEntryId,
      registerTransferDto,
    );
  }

  // ─── Global Movements Log ────────────────────────────────────

  @Get('movements')
  async findAllMovements(@Query() query: FindMovementsQueryDto) {
    return await this.inventoryService.findAllMovements(query);
  }

  // ─── Project Inventory (existing) ────────────────────────────

  @Get('project/:projectId/inactivation-blockers')
  async findProjectInactivationBlockers(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return await this.inventoryService.findProjectInactivationBlockers(
      projectId,
    );
  }

  @Get('project/:projectId')
  async findProjectInventory(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return await this.inventoryService.findProjectInventory(projectId);
  }

  @Get('element/:elementId')
  async findElementInventoryDetail(
    @Param('elementId', ParseIntPipe) elementId: number,
  ) {
    return await this.inventoryService.findElementInventoryDetail(elementId);
  }

  @Post('project-entry/:projectInventoryEntryId/return')
  @UserTypes(...PROJECT_INVENTORY_MANAGER_ROLES)
  async registerProjectReturn(
    @Param('projectInventoryEntryId', ParseIntPipe)
    projectInventoryEntryId: number,
    @Body() registerProjectReturnDto: RegisterProjectReturnDto,
  ) {
    return await this.inventoryService.registerProjectReturn(
      projectInventoryEntryId,
      registerProjectReturnDto,
    );
  }

  @Post('project-entry/:projectInventoryEntryId/assign-worker')
  @UserTypes(...PROJECT_ASSIGNMENT_ROLES)
  async registerWorkerAssignment(
    @Param('projectInventoryEntryId', ParseIntPipe)
    projectInventoryEntryId: number,
    @Body() registerWorkerAssignmentDto: RegisterWorkerAssignmentDto,
  ) {
    return await this.inventoryService.registerWorkerAssignment(
      projectInventoryEntryId,
      registerWorkerAssignmentDto,
    );
  }

  @Post('project-entry/:projectInventoryEntryId/assign-workers')
  @UserTypes(...PROJECT_ASSIGNMENT_ROLES)
  async registerWorkerAssignments(
    @Param('projectInventoryEntryId', ParseIntPipe)
    projectInventoryEntryId: number,
    @Body() registerWorkerAssignmentsDto: RegisterWorkerAssignmentsDto,
  ) {
    return await this.inventoryService.registerWorkerAssignments(
      projectInventoryEntryId,
      registerWorkerAssignmentsDto,
    );
  }

  @Delete('worker-assignment/:workerInventoryAssignmentId')
  @UserTypes()
  async deleteWorkerAssignment(
    @Param('workerInventoryAssignmentId', ParseIntPipe)
    workerInventoryAssignmentId: number,
  ) {
    return await this.inventoryService.deleteWorkerAssignment(
      workerInventoryAssignmentId,
    );
  }

  @Get('worker/:workerId/history')
  async findWorkerInventoryHistory(
    @Param('workerId', ParseIntPipe) workerId: number,
    @Query('family') family?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return await this.inventoryService.findWorkerInventoryHistory(workerId, {
      family,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }
}
