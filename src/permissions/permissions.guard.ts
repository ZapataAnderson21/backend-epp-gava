import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/user/jwt/public.decorator';
import { PermissionsService } from './permissions.service';
import { endpointPermissions, satisfies } from './endpoint-policy';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<{
      user?: { userId: number };
      permissions: string[];
      method: string;
      body?: Record<string, unknown>;
      params: Record<string, string>;
    }>();
    if (!request.user) throw new ForbiddenException('No autenticado.');
    const granted = await this.permissions.forUser(request.user.userId);
    request.permissions = granted;
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const requirePermission = (permission: string) => {
      if (!granted.includes(permission))
        throw new ForbiddenException(`No tienes permiso: ${permission}`);
    };
    const body = request.body ?? {};
    const statusOnly =
      controller === 'PurchaseOrderController' &&
      handler === 'update' &&
      Object.keys(body).length === 1 &&
      typeof body.status === 'string';
    const requirements = statusOnly
      ? [
          ['orders.view'],
          [body.status === 'delivered' ? 'orders.manage' : 'orders.authorize'],
        ]
      : endpointPermissions(controller, handler, request.method);
    if (!satisfies(granted, requirements))
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción.',
      );
    if (controller === 'UserController' && handler === 'create')
      requirePermission('users.assignRole');
    if (
      ((controller === 'UserController' && handler === 'create') ||
        (controller === 'PermissionsController' && handler === 'assign')) &&
      !granted.includes('roles.manage')
    ) {
      const roleId = Number(body.userTypeId);
      if (Number.isSafeInteger(roleId) && roleId > 0) {
        const role = await this.prisma.userType.findUnique({
          where: { userTypeId: roleId },
          select: { permissions: true },
        });
        if (
          role?.permissions.some((permission) => !granted.includes(permission))
        )
          throw new ForbiddenException(
            'No puedes asignar un rol con permisos superiores a los tuyos.',
          );
      }
    }
    if (
      controller === 'UserController' &&
      handler === 'update' &&
      !granted.includes('roles.manage')
    ) {
      const id = Number(request.params.id);
      if (Number.isSafeInteger(id) && id > 0) {
        const targetPermissions = await this.permissions.forUser(id);
        if (
          targetPermissions.some((permission) => !granted.includes(permission))
        )
          throw new ForbiddenException(
            'No puedes modificar las credenciales de un usuario con permisos superiores a los tuyos.',
          );
      }
    }
    if (
      controller === 'UserController' &&
      handler === 'update' &&
      'userTypeId' in body
    )
      requirePermission('users.assignRole');
    if (
      controller === 'ProjectController' &&
      handler === 'update' &&
      body.status
    ) {
      const id = Number(request.params.id);
      if (Number.isSafeInteger(id) && id > 0) {
        const previous = await this.prisma.project.findUnique({
          where: { projectId: id },
          select: { status: true },
        });
        if (previous && body.status !== previous.status)
          requirePermission('projects.status');
      }
    }
    if (controller === 'PurchaseOrderController' && body.status) {
      const id = Number(request.params.id);
      const previous =
        Number.isSafeInteger(id) && id > 0
          ? await this.prisma.purchaseOrder.findUnique({
              where: { purchaseOrderId: id },
              select: { status: true },
            })
          : null;
      if (body.status !== (previous?.status ?? 'pending'))
        requirePermission(
          body.status === 'delivered' ? 'orders.manage' : 'orders.authorize',
        );
    }
    if (
      controller === 'RequestResponseController' &&
      request.method !== 'GET'
    ) {
      for (const [field, permission] of Object.entries({
        adminDescription: 'requests.review',
        managementDescription: 'requests.approve',
        logisticsDescription: 'requests.attend',
      })) {
        if (field in body) requirePermission(permission);
      }
      if ('responderUserId' in body) body.responderUserId = request.user.userId;
    }
    if (
      controller === 'ElementRequestResponseController' &&
      request.method !== 'GET'
    )
      requirePermission('requests.attend');
    if (controller === 'GeneralPayrollController' && handler === 'save') {
      const workers = (body.workers ?? []) as Record<string, unknown>[];
      const entries = (body.entries ?? []) as Record<string, unknown>[];
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'dominical',
      ];
      if (
        Array.isArray(entries) &&
        entries.some(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            days.some((key) => key in entry),
        )
      )
        requirePermission('payroll.attendance');
      if (
        (Array.isArray(workers) && workers.length) ||
        (Array.isArray(entries) &&
          entries.some(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              ['overtimeAmount', 'afpDiscount', 'advanceDiscount'].some(
                (key) => key in entry,
              ),
          ))
      ) {
        requirePermission('payroll.payments');
        requirePermission('finance.view');
      }
    }
    if (
      controller === 'GeneralPayrollController' &&
      handler === 'updateAttendance'
    )
      requirePermission('payroll.attendance');
    if (
      controller === 'GeneralPayrollController' &&
      body.confirmClearAttendance
    ) {
      requirePermission('payroll.attendance');
      requirePermission('payroll.payments');
    }
    // Financial documents must not be an alternative path around redacted JSON.
    if (
      (/export|download|generatePdf|sum|total|findUnitValues|dashboard/i.test(
        handler,
      ) &&
        [
          'PurchaseOrderController',
          'QuotationController',
          'GeneralPayrollController',
          'PettyCashController',
          'ServiceSaleController',
        ].includes(controller)) ||
      (!statusOnly &&
        !['GET', 'DELETE'].includes(request.method) &&
        [
          'PurchaseOrderController',
          'ResourcePurchaseOrderController',
          'QuotationController',
          'PettyCashController',
          'ServiceSaleController',
        ].includes(controller))
    )
      requirePermission('finance.view');
    return true;
  }
}
