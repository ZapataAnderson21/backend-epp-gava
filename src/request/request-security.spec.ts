import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { RequestService } from './request.service';
import { RequestStatus } from './enum';
import { ElementRequestService } from 'src/element_request/element_request.service';
import { RequestWorkerService } from 'src/request-worker/request-worker.service';
import { ElementRequestWorkerPlanService } from 'src/element_request_worker_plan/element_request_worker_plan.service';
import { ElementRequestResponseService } from 'src/element_request_response/element_request_response.service';

describe('Request security boundaries', () => {
  it('authorizes sending to logistics before side effects', async () => {
    const prisma = {
      request: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 7,
          status: RequestStatus.draft,
        }),
      },
    };
    const permissions = {
      forUser: jest.fn().mockResolvedValue(['requests.manage']),
    };
    const service = new RequestService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      permissions as unknown as PermissionsService,
    );

    await expect(
      service.assertCanSendToLogistics(10, 8),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents adding an element to another user draft', async () => {
    const prisma = {
      request: {
        findUnique: jest.fn().mockResolvedValue({
          requestId: 10,
          userId: 7,
          status: RequestStatus.draft,
        }),
      },
      elementRequest: { create: jest.fn() },
    };
    const service = new ElementRequestService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create(
        {
          requestId: 10,
          elementId: 1,
          quantityRequested: 1,
          unit: 'UNIDAD',
        },
        8,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.elementRequest.create).not.toHaveBeenCalled();
  });

  it('prevents adding a worker to another user draft', async () => {
    const prisma = {
      request: {
        findUnique: jest.fn().mockResolvedValue({
          requestId: 10,
          userId: 7,
          status: RequestStatus.draft,
        }),
      },
      requestWorker: { create: jest.fn() },
    };
    const service = new RequestWorkerService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create({ requestId: 10, workerId: 2 }, 8),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.requestWorker.create).not.toHaveBeenCalled();
  });

  it('prevents reading EPI planning from another user draft', async () => {
    const prisma = {
      elementRequest: {
        findUnique: jest.fn().mockResolvedValue({
          requestId: 10,
          request: { userId: 7, status: RequestStatus.draft },
          element: { family: 'epi', type: 'epp', controlType: 'individual' },
        }),
      },
      elementRequestWorkerPlan: { findMany: jest.fn() },
    };
    const service = new ElementRequestWorkerPlanService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.findAllByElementRequestId(20, 8),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.elementRequestWorkerPlan.findMany).not.toHaveBeenCalled();
  });

  it('rejects cross-request response line associations', async () => {
    const prisma = {
      elementRequest: {
        findUnique: jest.fn().mockResolvedValue({
          requestId: 10,
          request: { status: RequestStatus.inProgress },
        }),
      },
      requestResponse: {
        findUnique: jest.fn().mockResolvedValue({ requestId: 11 }),
      },
      elementRequestResponse: { create: jest.fn(), findFirst: jest.fn() },
    };
    const service = new ElementRequestResponseService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create({
        elementRequestId: 20,
        requestResponseId: 30,
        quantityAccepted: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.elementRequestResponse.create).not.toHaveBeenCalled();
  });
});
