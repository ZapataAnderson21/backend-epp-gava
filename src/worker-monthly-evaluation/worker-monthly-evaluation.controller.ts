import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { GetUser } from 'src/decorators/get-user.decorator';
import { MonthlyEvaluationStatus } from 'src/generated/prisma';
import {
  MONTHLY_EVALUATION_ALLOWED_USER_TYPES,
  MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES,
} from './constants/worker-monthly-evaluation.constants';
import { CreateMonthlyEvaluationTemplateDto } from './dto/create-monthly-evaluation-template.dto';
import { CreateWorkerMonthlyEvaluationDto } from './dto/create-worker-monthly-evaluation.dto';
import { ListWorkerMonthlyEvaluationPeriodDto } from './dto/list-worker-monthly-evaluation-period.dto';
import { ListWorkerMonthlyEvaluationDto } from './dto/list-worker-monthly-evaluation.dto';
import { UpdateWorkerMonthlyEvaluationResponsesDto } from './dto/update-worker-monthly-evaluation-responses.dto';
import { WorkerMonthlyEvaluationPeriodDto } from './dto/worker-monthly-evaluation-period.dto';
import { WorkerMonthlyEvaluationService } from './worker-monthly-evaluation.service';

@Controller('worker-monthly-evaluation')
@UserTypes(...MONTHLY_EVALUATION_ALLOWED_USER_TYPES)
export class WorkerMonthlyEvaluationController {
  private readonly logger = new Logger('WorkerMonthlyEvaluationController');

  constructor(
    private readonly workerMonthlyEvaluationService: WorkerMonthlyEvaluationService,
  ) {}

  @Post('template')
  createTemplate(
    @Body() dto: CreateMonthlyEvaluationTemplateDto,
    @GetUser('userId') userId: number,
  ) {
    this.logger.log(
      `Creando plantilla mensual para evaluaciones. userId=${userId}`,
    );
    return this.workerMonthlyEvaluationService.createTemplate(
      dto,
      Number(userId),
    );
  }

  @Get('template')
  listTemplates() {
    return this.workerMonthlyEvaluationService.listTemplates();
  }

  @Patch('template/:templateId')
  updateTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreateMonthlyEvaluationTemplateDto,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.updateTemplate(
      templateId,
      dto,
      Number(userId),
    );
  }

  @Get('template/:templateId')
  findTemplate(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.workerMonthlyEvaluationService.findTemplate(templateId);
  }

  @Post('template/:templateId/duplicate')
  duplicateTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.duplicateTemplate(
      templateId,
      Number(userId),
    );
  }

  @Post('instance')
  createEvaluation(
    @Body() dto: CreateWorkerMonthlyEvaluationDto,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.createEvaluation(
      dto,
      Number(userId),
    );
  }

  @Get('period')
  listEvaluationPeriods(
    @Query() filters: ListWorkerMonthlyEvaluationPeriodDto,
  ) {
    return this.workerMonthlyEvaluationService.listEvaluationPeriods(filters);
  }

  @Get('period/detail')
  findEvaluationPeriodDetail(
    @Query() period: WorkerMonthlyEvaluationPeriodDto,
  ) {
    return this.workerMonthlyEvaluationService.findEvaluationPeriodDetail(
      period,
    );
  }

  @Patch('period/open')
  @UserTypes(...MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES)
  openEvaluationPeriod(
    @Body() period: WorkerMonthlyEvaluationPeriodDto,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.setEvaluationPeriodStatus(
      period,
      MonthlyEvaluationStatus.open,
      Number(userId),
    );
  }

  @Patch('period/close')
  @UserTypes(...MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES)
  closeEvaluationPeriod(
    @Body() period: WorkerMonthlyEvaluationPeriodDto,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.setEvaluationPeriodStatus(
      period,
      MonthlyEvaluationStatus.closed,
      Number(userId),
    );
  }

  @Get('instance')
  listEvaluations(@Query() filters: ListWorkerMonthlyEvaluationDto) {
    return this.workerMonthlyEvaluationService.findAllEvaluations(filters);
  }

  @Get('instance/:workerMonthlyEvaluationId')
  findOneEvaluation(
    @Param('workerMonthlyEvaluationId', ParseIntPipe)
    workerMonthlyEvaluationId: number,
  ) {
    return this.workerMonthlyEvaluationService.findOneEvaluation(
      workerMonthlyEvaluationId,
    );
  }

  @Patch('instance/:workerMonthlyEvaluationId/responses')
  updateResponses(
    @Param('workerMonthlyEvaluationId', ParseIntPipe)
    workerMonthlyEvaluationId: number,
    @Body() dto: UpdateWorkerMonthlyEvaluationResponsesDto,
  ) {
    return this.workerMonthlyEvaluationService.updateResponses(
      workerMonthlyEvaluationId,
      dto,
    );
  }

  @Patch('instance/:workerMonthlyEvaluationId/open')
  @UserTypes(...MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES)
  openEvaluation(
    @Param('workerMonthlyEvaluationId', ParseIntPipe)
    workerMonthlyEvaluationId: number,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.setEvaluationStatus(
      workerMonthlyEvaluationId,
      MonthlyEvaluationStatus.open,
      Number(userId),
    );
  }

  @Patch('instance/:workerMonthlyEvaluationId/close')
  @UserTypes(...MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES)
  closeEvaluation(
    @Param('workerMonthlyEvaluationId', ParseIntPipe)
    workerMonthlyEvaluationId: number,
    @GetUser('userId') userId: number,
  ) {
    return this.workerMonthlyEvaluationService.setEvaluationStatus(
      workerMonthlyEvaluationId,
      MonthlyEvaluationStatus.closed,
      Number(userId),
    );
  }
}
