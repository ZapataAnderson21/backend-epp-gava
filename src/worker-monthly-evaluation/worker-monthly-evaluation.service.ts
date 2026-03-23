import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  MonthlyEvaluationQuestionType,
  MonthlyEvaluationStatus,
} from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateMonthlyEvaluationTemplateDto,
  CreateMonthlyEvaluationQuestionDto,
} from './dto/create-monthly-evaluation-template.dto';
import {
  CreateWorkerMonthlyEvaluationDto,
  MonthlyEvaluationResponseInputDto,
} from './dto/create-worker-monthly-evaluation.dto';
import { UpdateWorkerMonthlyEvaluationResponsesDto } from './dto/update-worker-monthly-evaluation-responses.dto';
import { ListWorkerMonthlyEvaluationDto } from './dto/list-worker-monthly-evaluation.dto';
import {
  PERFORMANCE_LABELS,
  SCORE_MAX,
  SCORE_MIN,
} from './constants/worker-monthly-evaluation.constants';

type QuestionSnapshot = {
  monthlyEvaluationQuestionId: number;
  questionType: MonthlyEvaluationQuestionType;
  isScored: boolean;
  minScore: number;
  maxScore: number;
};

@Injectable()
export class WorkerMonthlyEvaluationService {
  private readonly logger = new Logger('WorkerMonthlyEvaluationService');

  constructor(private readonly prismaService: PrismaService) {}

  async createTemplate(
    dto: CreateMonthlyEvaluationTemplateDto,
    currentUserId: number,
  ) {
    const normalizedSections = dto.sections.map((section, sectionIndex) => ({
      ...section,
      displayOrder: sectionIndex,
      questions: section.questions.map((question, questionIndex) =>
        this.normalizeQuestion(question, questionIndex),
      ),
    }));

    const maxScore = this.calculateMaxScore(
      normalizedSections.flatMap((section) => section.questions),
    );
    this.validateThresholds(
      dto.observedMaxScore,
      dto.regularMaxScore,
      maxScore,
    );

    const created = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.monthlyEvaluationTemplate.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          createdByUserId: currentUserId,
          versions: {
            create: {
              versionNumber: 1,
              title: dto.name.trim(),
              description: dto.description?.trim(),
              observedMaxScore: dto.observedMaxScore,
              regularMaxScore: dto.regularMaxScore,
              sections: {
                create: normalizedSections.map((section) => ({
                  title: section.title.trim(),
                  displayOrder: section.displayOrder,
                  questions: {
                    create: section.questions.map((question) => ({
                      displayOrder: question.displayOrder,
                      prompt: question.prompt,
                      questionType: question.questionType,
                      isRequired: question.isRequired,
                      isScored: question.isScored,
                      minScore: question.minScore,
                      maxScore: question.maxScore,
                      metadata: question.metadata as
                        | Prisma.InputJsonValue
                        | undefined,
                    })),
                  },
                })),
              },
            },
          },
        },
        include: {
          versions: {
            include: {
              sections: {
                include: {
                  questions: true,
                },
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      });

      return template;
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Plantilla mensual creada con exito.',
      data: created,
    };
  }

  async listTemplates() {
    const templates =
      await this.prismaService.monthlyEvaluationTemplate.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              sections: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  questions: {
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

    return {
      statusCode: HttpStatus.OK,
      message: 'Plantillas recuperadas con exito.',
      data: templates,
    };
  }

  async findTemplate(templateId: number) {
    const template =
      await this.prismaService.monthlyEvaluationTemplate.findFirst({
        where: { monthlyEvaluationTemplateId: templateId, deletedAt: null },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              sections: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  questions: {
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

    if (!template) {
      throw new NotFoundException('No se encontro la plantilla solicitada.');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Plantilla recuperada con exito.',
      data: template,
    };
  }

  async duplicateTemplate(templateId: number, currentUserId: number) {
    const sourceTemplate =
      await this.prismaService.monthlyEvaluationTemplate.findFirst({
        where: { monthlyEvaluationTemplateId: templateId, deletedAt: null },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              sections: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  questions: {
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

    if (!sourceTemplate || sourceTemplate.versions.length === 0) {
      throw new NotFoundException(
        'No se encontro la plantilla base a duplicar.',
      );
    }

    const baseVersion = sourceTemplate.versions[0];

    const duplicated =
      await this.prismaService.monthlyEvaluationTemplate.create({
        data: {
          name: `${sourceTemplate.name} (Copia)`,
          description: sourceTemplate.description,
          createdByUserId: currentUserId,
          versions: {
            create: {
              versionNumber: 1,
              title: `${baseVersion.title} (Copia)`,
              description: baseVersion.description,
              observedMaxScore: baseVersion.observedMaxScore,
              regularMaxScore: baseVersion.regularMaxScore,
              sections: {
                create: baseVersion.sections.map((section) => ({
                  title: section.title,
                  displayOrder: section.displayOrder,
                  questions: {
                    create: section.questions.map((question) => ({
                      displayOrder: question.displayOrder,
                      prompt: question.prompt,
                      questionType: question.questionType,
                      isRequired: question.isRequired,
                      isScored: question.isScored,
                      minScore: question.minScore,
                      maxScore: question.maxScore,
                      metadata:
                        (question.metadata as Prisma.InputJsonValue | null) ??
                        undefined,
                    })),
                  },
                })),
              },
            },
          },
        },
        include: {
          versions: {
            include: {
              sections: {
                include: {
                  questions: true,
                },
              },
            },
          },
        },
      });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Plantilla duplicada con exito.',
      data: duplicated,
    };
  }

  async createEvaluation(
    dto: CreateWorkerMonthlyEvaluationDto,
    currentUserId: number,
  ) {
    const worker = await this.prismaService.worker.findFirst({
      where: {
        workerId: dto.workerId,
        deletedAt: null,
      },
    });

    if (!worker) {
      throw new NotFoundException(
        'El trabajador no existe o esta deshabilitado.',
      );
    }

    const templateVersion =
      await this.prismaService.monthlyEvaluationTemplateVersion.findUnique({
        where: {
          monthlyEvaluationTemplateVersionId:
            dto.monthlyEvaluationTemplateVersionId,
        },
        include: {
          template: true,
          sections: {
            include: {
              questions: true,
            },
          },
        },
      });

    if (!templateVersion || templateVersion.template.deletedAt) {
      throw new NotFoundException(
        'La version de plantilla indicada no existe.',
      );
    }

    const sequence = dto.sequence ?? 1;

    const existing =
      await this.prismaService.workerMonthlyEvaluation.findUnique({
        where: {
          workerId_year_month_sequence: {
            workerId: dto.workerId,
            year: dto.year,
            month: dto.month,
            sequence,
          },
        },
      });

    if (existing) {
      throw new ConflictException(
        'Ya existe una evaluacion para ese trabajador, periodo y secuencia.',
      );
    }

    const questions = templateVersion.sections.flatMap(
      (section) => section.questions,
    );
    const questionMap = new Map<number, QuestionSnapshot>(
      questions.map((question) => [
        question.monthlyEvaluationQuestionId,
        {
          monthlyEvaluationQuestionId: question.monthlyEvaluationQuestionId,
          questionType: question.questionType,
          isScored: question.isScored,
          minScore: question.minScore,
          maxScore: question.maxScore,
        },
      ]),
    );

    const responses = dto.responses ?? [];
    for (const response of responses) {
      this.validateResponseAgainstQuestion(response, questionMap);
    }

    const evaluatorUserId = currentUserId;

    const createdEvaluation = await this.prismaService.$transaction(
      async (tx) => {
        const evaluation = await tx.workerMonthlyEvaluation.create({
          data: {
            workerId: dto.workerId,
            monthlyEvaluationTemplateVersionId:
              dto.monthlyEvaluationTemplateVersionId,
            year: dto.year,
            month: dto.month,
            sequence,
            status: MonthlyEvaluationStatus.open,
            evaluatorUserId,
            openedByUserId: currentUserId,
            openedAt: new Date(),
            generalComment: dto.generalComment?.trim(),
          },
        });

        if (responses.length > 0) {
          await tx.workerMonthlyEvaluationResponse.createMany({
            data: responses.map((response) => {
              const question = questionMap.get(
                response.monthlyEvaluationQuestionId,
              )!;
              return {
                workerMonthlyEvaluationId: evaluation.workerMonthlyEvaluationId,
                monthlyEvaluationQuestionId:
                  response.monthlyEvaluationQuestionId,
                score:
                  question.questionType === MonthlyEvaluationQuestionType.score
                    ? (response.score ?? null)
                    : null,
                textAnswer:
                  question.questionType === MonthlyEvaluationQuestionType.text
                    ? (response.textAnswer?.trim() ?? null)
                    : null,
              };
            }),
          });
        }

        const computed = await this.computeEvaluationScores(
          tx,
          evaluation.workerMonthlyEvaluationId,
          templateVersion.observedMaxScore,
          templateVersion.regularMaxScore,
        );

        return tx.workerMonthlyEvaluation.update({
          where: {
            workerMonthlyEvaluationId: evaluation.workerMonthlyEvaluationId,
          },
          data: {
            totalScore: computed.totalScore,
            maxScore: computed.maxScore,
            performanceLabel: computed.performanceLabel,
          },
          include: this.evaluationInclude(),
        });
      },
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Evaluacion mensual creada con exito.',
      data: this.formatEvaluationOutput(createdEvaluation),
    };
  }

  async findAllEvaluations(filters: ListWorkerMonthlyEvaluationDto) {
    const evaluations =
      await this.prismaService.workerMonthlyEvaluation.findMany({
        where: {
          workerId: filters.workerId,
          month: filters.month,
          year: filters.year,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { sequence: 'desc' }],
        include: this.evaluationInclude(),
      });

    return {
      statusCode: HttpStatus.OK,
      message: 'Evaluaciones recuperadas con exito.',
      data: evaluations.map((evaluation) =>
        this.formatEvaluationOutput(evaluation),
      ),
    };
  }

  async findOneEvaluation(workerMonthlyEvaluationId: number) {
    const evaluation =
      await this.prismaService.workerMonthlyEvaluation.findUnique({
        where: { workerMonthlyEvaluationId },
        include: this.evaluationInclude(),
      });

    if (!evaluation) {
      throw new NotFoundException('No se encontro la evaluacion solicitada.');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Evaluacion recuperada con exito.',
      data: this.formatEvaluationOutput(evaluation),
    };
  }

  async updateResponses(
    workerMonthlyEvaluationId: number,
    dto: UpdateWorkerMonthlyEvaluationResponsesDto,
  ) {
    const evaluation =
      await this.prismaService.workerMonthlyEvaluation.findUnique({
        where: { workerMonthlyEvaluationId },
        include: {
          templateVersion: {
            include: {
              sections: {
                include: {
                  questions: true,
                },
              },
            },
          },
        },
      });

    if (!evaluation) {
      throw new NotFoundException('No se encontro la evaluacion indicada.');
    }

    if (evaluation.status !== MonthlyEvaluationStatus.open) {
      throw new BadRequestException(
        'La evaluacion esta cerrada y no se puede editar.',
      );
    }

    const questionMap = new Map<number, QuestionSnapshot>(
      evaluation.templateVersion.sections
        .flatMap((section) => section.questions)
        .map((question) => [
          question.monthlyEvaluationQuestionId,
          {
            monthlyEvaluationQuestionId: question.monthlyEvaluationQuestionId,
            questionType: question.questionType,
            isScored: question.isScored,
            minScore: question.minScore,
            maxScore: question.maxScore,
          },
        ]),
    );

    for (const response of dto.responses) {
      this.validateResponseAgainstQuestion(response, questionMap);
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      for (const response of dto.responses) {
        const question = questionMap.get(response.monthlyEvaluationQuestionId)!;
        await tx.workerMonthlyEvaluationResponse.upsert({
          where: {
            workerMonthlyEvaluationId_monthlyEvaluationQuestionId: {
              workerMonthlyEvaluationId,
              monthlyEvaluationQuestionId: response.monthlyEvaluationQuestionId,
            },
          },
          create: {
            workerMonthlyEvaluationId,
            monthlyEvaluationQuestionId: response.monthlyEvaluationQuestionId,
            score:
              question.questionType === MonthlyEvaluationQuestionType.score
                ? (response.score ?? null)
                : null,
            textAnswer:
              question.questionType === MonthlyEvaluationQuestionType.text
                ? (response.textAnswer?.trim() ?? null)
                : null,
          },
          update: {
            score:
              question.questionType === MonthlyEvaluationQuestionType.score
                ? (response.score ?? null)
                : null,
            textAnswer:
              question.questionType === MonthlyEvaluationQuestionType.text
                ? (response.textAnswer?.trim() ?? null)
                : null,
          },
        });
      }

      const computed = await this.computeEvaluationScores(
        tx,
        workerMonthlyEvaluationId,
        evaluation.templateVersion.observedMaxScore,
        evaluation.templateVersion.regularMaxScore,
      );

      return tx.workerMonthlyEvaluation.update({
        where: { workerMonthlyEvaluationId },
        data: {
          generalComment:
            dto.generalComment === undefined
              ? evaluation.generalComment
              : dto.generalComment.trim(),
          totalScore: computed.totalScore,
          maxScore: computed.maxScore,
          performanceLabel: computed.performanceLabel,
        },
        include: this.evaluationInclude(),
      });
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Respuestas de evaluacion actualizadas con exito.',
      data: this.formatEvaluationOutput(updated),
    };
  }

  async setEvaluationStatus(
    workerMonthlyEvaluationId: number,
    status: MonthlyEvaluationStatus,
    currentUserId: number,
  ) {
    const evaluation =
      await this.prismaService.workerMonthlyEvaluation.findUnique({
        where: { workerMonthlyEvaluationId },
      });

    if (!evaluation) {
      throw new NotFoundException('No se encontro la evaluacion indicada.');
    }

    if (evaluation.status === status) {
      return {
        statusCode: HttpStatus.OK,
        message: `La evaluacion ya estaba en estado ${status}.`,
        data: evaluation,
      };
    }

    const updated = await this.prismaService.workerMonthlyEvaluation.update({
      where: { workerMonthlyEvaluationId },
      data:
        status === MonthlyEvaluationStatus.open
          ? {
              status,
              openedByUserId: currentUserId,
              openedAt: new Date(),
              closedByUserId: null,
              closedAt: null,
            }
          : {
              status,
              closedByUserId: currentUserId,
              closedAt: new Date(),
            },
      include: this.evaluationInclude(),
    });

    return {
      statusCode: HttpStatus.OK,
      message:
        status === MonthlyEvaluationStatus.open
          ? 'Evaluacion abierta con exito.'
          : 'Evaluacion cerrada con exito.',
      data: this.formatEvaluationOutput(updated),
    };
  }

  private normalizeQuestion(
    question: CreateMonthlyEvaluationQuestionDto,
    displayOrder: number,
  ) {
    const questionType =
      question.questionType === 'text'
        ? MonthlyEvaluationQuestionType.text
        : MonthlyEvaluationQuestionType.score;

    if (questionType === MonthlyEvaluationQuestionType.score) {
      return {
        ...question,
        prompt: question.prompt.trim(),
        displayOrder,
        questionType,
        isRequired: question.isRequired ?? true,
        isScored: true,
        minScore: SCORE_MIN,
        maxScore: SCORE_MAX,
      };
    }

    return {
      ...question,
      prompt: question.prompt.trim(),
      displayOrder,
      questionType,
      isRequired: question.isRequired ?? false,
      isScored: false,
      minScore: SCORE_MIN,
      maxScore: SCORE_MAX,
    };
  }

  private calculateMaxScore(
    questions: Array<{ isScored: boolean; maxScore: number }>,
  ) {
    return questions.reduce(
      (acc, question) => (question.isScored ? acc + question.maxScore : acc),
      0,
    );
  }

  private validateThresholds(
    observedMaxScore: number,
    regularMaxScore: number,
    maxScore: number,
  ) {
    if (maxScore <= 0) {
      throw new BadRequestException(
        'La plantilla debe tener al menos una pregunta con puntaje.',
      );
    }

    if (observedMaxScore < 0 || observedMaxScore > maxScore) {
      throw new BadRequestException(
        'El umbral observado debe estar entre 0 y el puntaje maximo.',
      );
    }

    if (regularMaxScore <= observedMaxScore || regularMaxScore > maxScore) {
      throw new BadRequestException(
        'El umbral de mejora debe ser mayor que el observado y menor o igual al puntaje maximo.',
      );
    }
  }

  private validateResponseAgainstQuestion(
    response: MonthlyEvaluationResponseInputDto,
    questionMap: Map<number, QuestionSnapshot>,
  ) {
    const question = questionMap.get(response.monthlyEvaluationQuestionId);

    if (!question) {
      throw new BadRequestException(
        `La pregunta ${response.monthlyEvaluationQuestionId} no pertenece a la plantilla version seleccionada.`,
      );
    }

    if (question.questionType === MonthlyEvaluationQuestionType.score) {
      if (response.score === undefined || response.score === null) {
        throw new BadRequestException(
          `La pregunta ${response.monthlyEvaluationQuestionId} requiere un puntaje entre 0 y 3.`,
        );
      }

      if (response.score < SCORE_MIN || response.score > SCORE_MAX) {
        throw new BadRequestException(
          `La pregunta ${response.monthlyEvaluationQuestionId} solo acepta puntajes entre 0 y 3.`,
        );
      }

      return;
    }

    if (response.score !== undefined) {
      throw new BadRequestException(
        `La pregunta ${response.monthlyEvaluationQuestionId} es textual y no acepta puntaje.`,
      );
    }
  }

  private async computeEvaluationScores(
    tx: Prisma.TransactionClient,
    workerMonthlyEvaluationId: number,
    observedMaxScore: number,
    regularMaxScore: number,
  ) {
    const responses = await tx.workerMonthlyEvaluationResponse.findMany({
      where: { workerMonthlyEvaluationId },
      include: {
        question: true,
      },
    });

    const totalScore = responses.reduce((acc, response) => {
      if (!response.question.isScored || response.score === null) {
        return acc;
      }
      return acc + response.score;
    }, 0);

    const maxScore = responses.reduce((acc, response) => {
      if (!response.question.isScored) {
        return acc;
      }
      return acc + response.question.maxScore;
    }, 0);

    let performanceLabel: string = PERFORMANCE_LABELS.excellent;
    if (totalScore <= observedMaxScore) {
      performanceLabel = PERFORMANCE_LABELS.observed;
    } else if (totalScore <= regularMaxScore) {
      performanceLabel = PERFORMANCE_LABELS.improvable;
    }

    return {
      totalScore,
      maxScore,
      performanceLabel,
    };
  }

  private evaluationInclude() {
    return {
      worker: true,
      evaluatorUser: {
        select: {
          userId: true,
          name: true,
          lastName: true,
          email: true,
        },
      },
      openedByUser: {
        select: {
          userId: true,
          name: true,
          lastName: true,
          email: true,
        },
      },
      closedByUser: {
        select: {
          userId: true,
          name: true,
          lastName: true,
          email: true,
        },
      },
      templateVersion: {
        include: {
          sections: {
            orderBy: { displayOrder: 'asc' as const },
            include: {
              questions: {
                orderBy: { displayOrder: 'asc' as const },
              },
            },
          },
        },
      },
      responses: {
        orderBy: {
          monthlyEvaluationQuestionId: 'asc' as const,
        },
      },
    };
  }

  private formatEvaluationOutput(evaluation: any) {
    const observedMaxScore = evaluation.templateVersion.observedMaxScore;
    const regularMaxScore = evaluation.templateVersion.regularMaxScore;
    const excellentMaxScore = evaluation.maxScore;

    return {
      ...evaluation,
      scoreLegend: {
        0: 'No cumple con los criterios de evaluacion.',
        1: 'Cumple regularmente.',
        2: 'Cumple satisfactoriamente pero puede mejorar.',
        3: 'Cumple notablemente.',
      },
      performanceScale: [
        {
          min: 0,
          max: observedMaxScore,
          label: PERFORMANCE_LABELS.observed,
        },
        {
          min: observedMaxScore + 1,
          max: regularMaxScore,
          label: PERFORMANCE_LABELS.improvable,
        },
        {
          min: regularMaxScore + 1,
          max: excellentMaxScore,
          label: PERFORMANCE_LABELS.excellent,
        },
      ],
    };
  }
}
