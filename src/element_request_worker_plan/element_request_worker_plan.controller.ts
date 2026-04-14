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

@Controller('element-request-worker-plan')
export class ElementRequestWorkerPlanController {
  constructor(
    private readonly elementRequestWorkerPlanService: ElementRequestWorkerPlanService,
  ) {}

  @Get('element-request/:elementRequestId')
  async findAllByElementRequestId(
    @Param('elementRequestId', ParseIntPipe) elementRequestId: number,
  ) {
    return await this.elementRequestWorkerPlanService.findAllByElementRequestId(
      elementRequestId,
    );
  }

  @Put('element-request/:elementRequestId')
  async replaceForElementRequest(
    @Param('elementRequestId', ParseIntPipe) elementRequestId: number,
    @Body() replaceDto: ReplaceElementRequestWorkerPlansDto,
  ) {
    return await this.elementRequestWorkerPlanService.replaceForElementRequest(
      elementRequestId,
      replaceDto,
    );
  }
}
