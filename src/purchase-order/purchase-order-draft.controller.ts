import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { GetUser } from 'src/decorators/get-user.decorator';
import { UserTypes } from 'src/decorators/user-types.decorator';
import {
  DraftSlotDto,
  SavePurchaseOrderDraftDto,
} from './dto/purchase-order-draft.dto';
import { PurchaseOrderDraftService } from './purchase-order-draft.service';

@Controller('purchase-order-draft')
@UserTypes('GERENTE', 'ADMINISTRADORA', 'LOGISTICA')
export class PurchaseOrderDraftController {
  constructor(private readonly drafts: PurchaseOrderDraftService) {}

  @Get(':projectId/:slot')
  @Header('Cache-Control', 'private, no-store')
  read(
    @GetUser('userId') userId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param() params: DraftSlotDto,
  ) {
    return this.drafts.read(userId, projectId, params.slot);
  }

  @Put(':projectId/:slot')
  save(
    @GetUser('userId') userId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param() params: DraftSlotDto,
    @Body() dto: SavePurchaseOrderDraftDto,
  ) {
    return this.drafts.save(userId, projectId, params.slot, dto);
  }
}
