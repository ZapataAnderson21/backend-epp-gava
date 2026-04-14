import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RegisterProjectReturnDto } from './dto/register-project-return.dto';
import { UserTypes } from 'src/decorators/user-types.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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
  @UserTypes(
    'GERENTE',
    'ADMINISTRADOR',
    'ADMINISTRADORA',
    'LOGISTICA',
    'PREVENCIONISTA DE RIESGOS',
  )
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
}
