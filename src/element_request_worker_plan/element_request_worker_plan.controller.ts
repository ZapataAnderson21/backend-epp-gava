import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { ElementRequestWorkerPlanService } from './element_request_worker_plan.service';
import { ReplaceElementRequestWorkerPlansDto } from './dto/replace-element_request_worker_plans.dto';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('element-request-worker-plan')
export class ElementRequestWorkerPlanController {
  constructor(
    private readonly elementRequestWorkerPlanService: ElementRequestWorkerPlanService,
  ) {}

  @Get('element-request/:elementRequestId')
  async findAllByElementRequestId(
    @Param('elementRequestId', ParseIntPipe) elementRequestId: number,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestWorkerPlanService.findAllByElementRequestId(
      elementRequestId,
      userId,
    );
  }

  @Put('element-request/:elementRequestId')
  async replaceForElementRequest(
    @Param('elementRequestId', ParseIntPipe) elementRequestId: number,
    @Body() replaceDto: ReplaceElementRequestWorkerPlansDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.elementRequestWorkerPlanService.replaceForElementRequest(
      elementRequestId,
      replaceDto,
      userId,
    );
  }
}
