import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { GetUser } from 'src/decorators/get-user.decorator';
import { RenumberService } from './renumber.service';
import { ApplyRenumberDto, PreviewRenumberDto } from './renumber.dto';

@Controller('purchase-order-numbering')
export class RenumberController {
  constructor(private readonly service: RenumberService) {}
  @Get('candidates')
  candidates(@Query('year', ParseIntPipe) year: number) {
    return this.service.candidates(year);
  }
  @Post('preview')
  preview(@Body() dto: PreviewRenumberDto, @GetUser('userId') userId: number) {
    return this.service.preview(dto, userId);
  }
  @Post(':id/apply')
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyRenumberDto,
    @GetUser('userId') userId: number,
  ) {
    return this.service.apply(id, dto.reason, userId);
  }
  @Get('history')
  history(
    @Query('year', ParseIntPipe) year: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ) {
    return this.service.history(year, page ?? 1);
  }
}
