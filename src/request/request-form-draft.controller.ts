import { Body, Controller, Get, Header, Param, Put } from '@nestjs/common';
import { GetUser } from 'src/decorators/get-user.decorator';
import {
  RequestDraftSlotDto,
  SaveRequestFormDraftDto,
} from './dto/request-form-draft.dto';
import { RequestFormDraftService } from './request-form-draft.service';

@Controller('request-form-draft')
export class RequestFormDraftController {
  constructor(private readonly drafts: RequestFormDraftService) {}
  @Get(':slot')
  @Header('Cache-Control', 'private, no-store')
  read(
    @GetUser('userId') userId: number,
    @Param() params: RequestDraftSlotDto,
  ) {
    return this.drafts.read(userId, params.slot);
  }
  @Put(':slot')
  save(
    @GetUser('userId') userId: number,
    @Param() params: RequestDraftSlotDto,
    @Body() dto: SaveRequestFormDraftDto,
  ) {
    return this.drafts.save(userId, params.slot, dto);
  }
}
