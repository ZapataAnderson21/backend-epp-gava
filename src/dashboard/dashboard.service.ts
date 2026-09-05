import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardQueryDto } from './dashboard-query.dto';
import {
  dashboardPeriod,
  dashboardPermissions,
  emptyAmounts,
  limaDate,
  payrollAmounts,
  roundMoney,
  summarizeAmounts,
} from './dashboard-calculations';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async findGeneral(query: DashboardQueryDto, userId: number) {
    const now = new Date();
    const today = limaDate(now);
    const month = query.month ?? Number(today.slice(5, 7));
    const year = query.year ?? Number(today.slice(0, 4));
    const currency = query.currency ?? 'PEN';
    const period = dashboardPeriod(month, year);
    const selectedKey = period.keys[5];
    const [links, projectOptions] = await Promise.all([
      this.prisma.userUserType.findMany({
        where: { userId },
        select: { userType: { select: { name: true } } },
      }),
      this.prisma.project.findMany({
        where: { deletedAt: null },
        select: {
          projectId: true,
          name: true,
          code: true,
          status: true,
          endDate: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    const permissions = dashboardPermissions(
      links.map((link) => link.userType.name),
    );
    if (
      query.projectId &&
      !projectOptions.some((project) => project.projectId === query.projectId)
    ) {
      throw new NotFoundException('El proyecto seleccionado no existe.');
    }
    const projects = projectOptions.filter(
      (project) => !query.projectId || project.projectId === query.projectId,
    );
    const projectIds = projects.map((project) => project.projectId);
    const scope = { projectId: { in: projectIds } };
    const dates = { gte: period.from, lt: period.to };
    const daysAgo = new Date(now.getTime() - 7 * 86400000);
    const documentLimit = new Date(`${today}T00:00:00Z`);
    documentLimit.setUTCDate(documentLimit.getUTCDate() + 30);

    const [
      orders,
      incomes,
      cash,
      payrolls,
      tasks,
      pendingOrders,
      requests,
      emergencies,
      documents,
      stock,
    ] = await Promise.all([
      permissions.finance
        ? this.prisma.purchaseOrder.findMany({
            where: {
              ...scope,
              status: { not: 'cancelled' },
              createdAt: dates,
              supplier: { currency },
            },
            select: {
              projectId: true,
              createdAt: true,
              purchaseAmount: true,
              saleAmount: true,
              purchaseOrderType: true,
              status: true,
            },
          })
        : [],
      permissions.finance
        ? this.prisma.serviceSale.findMany({
            where: { ...scope, currency, createdAt: dates },
            select: { projectId: true, createdAt: true, amount: true },
          })
        : [],
      permissions.finance && currency === 'PEN'
        ? this.prisma.pettyCash.findMany({
            where: { ...scope, expenseDate: dates },
            select: {
              projectId: true,
              expenseDate: true,
              amount: true,
              includesIgv: true,
            },
          })
        : [],
      permissions.payroll
        ? this.prisma.generalPayroll.findMany({
            where: {
              week: {
                endDate: { gte: new Date(`${period.keys[0]}-01T00:00:00Z`) },
                startDate: { lt: new Date(`${period.endDate}T00:00:00Z`) },
              },
              projects: { some: scope },
            },
            select: {
              week: {
                select: { weekId: true, startDate: true, endDate: true },
              },
              workers: {
                select: {
                  generalPayrollWorkerId: true,
                  workerId: true,
                  group: true,
                  dailyWage: true,
                  additionalAmount: true,
                  liquidationAmount: true,
                  sundayDinnerAmount: true,
                },
              },
              projects: {
                where: scope,
                select: {
                  projectId: true,
                  entries: {
                    where: { isActive: true },
                    select: {
                      generalPayrollWorkerId: true,
                      monday: true,
                      tuesday: true,
                      wednesday: true,
                      thursday: true,
                      friday: true,
                      saturday: true,
                      dominical: true,
                      overtimeAmount: true,
                      afpDiscount: true,
                      advanceDiscount: true,
                    },
                  },
                },
              },
            },
            orderBy: { week: { startDate: 'desc' } },
          })
        : [],
      this.prisma.task.findMany({
        where: scope,
        select: { projectId: true, status: true, dueDate: true },
      }),
      permissions.purchases
        ? this.prisma.purchaseOrder.findMany({
            where: { ...scope, status: 'pending', createdAt: { lte: daysAgo } },
            select: { projectId: true },
          })
        : [],
      this.prisma.request.findMany({
        where: {
          ...scope,
          status: { in: ['inProgress', 'reviewed', 'approved'] },
          deliveryDueDate: { lt: now },
        },
        select: { projectId: true },
      }),
      this.prisma.emergency.findMany({
        where: { ...scope, status: 'pending' },
        select: { projectId: true },
      }),
      permissions.documents
        ? this.prisma.expiringDocument.findMany({
            where: {
              deletedAt: null,
              category: { deletedAt: null },
              expirationDate: { lte: documentLimit },
            },
            select: { expirationDate: true },
          })
        : [],
      this.prisma.element.findMany({
        where: { deletedAt: null, stockMinimum: { gt: 0 } },
        select: {
          stockMinimum: true,
          officeInventoryEntries: {
            where: { status: 'available' },
            select: { currentStock: true },
          },
        },
      }),
    ]);

    const trend = new Map(period.keys.map((key) => [key, emptyAmounts()]));
    const projectAmounts = new Map(
      projectIds.map((id) => [id, emptyAmounts()]),
    );
    const add = (
      key: string,
      projectId: number | null,
      category: keyof ReturnType<typeof emptyAmounts>,
      value: number,
    ) => {
      const bucket = trend.get(key);
      if (bucket) bucket[category] += value;
      if (key === selectedKey && projectId !== null) {
        const project = projectAmounts.get(projectId);
        if (project) project[category] += value;
      }
    };
    for (const order of orders) {
      const key = limaDate(order.createdAt).slice(0, 7);
      add(key, order.projectId, 'income', Number(order.saleAmount));
      add(
        key,
        order.projectId,
        order.purchaseOrderType,
        Number(order.purchaseAmount),
      );
    }
    for (const income of incomes)
      add(
        limaDate(income.createdAt).slice(0, 7),
        income.projectId,
        'income',
        Number(income.amount),
      );
    for (const item of cash)
      add(
        limaDate(item.expenseDate).slice(0, 7),
        item.projectId,
        'pettyCash',
        roundMoney(Number(item.amount) * (item.includesIgv ? 1 : 1.18)),
      );

    const weeks = payrolls
      .map((payroll) => {
        const key = payroll.week.endDate.toISOString().slice(0, 7);
        const roster = new Map(
          payroll.workers.map((worker) => [
            worker.generalPayrollWorkerId,
            worker,
          ]),
        );
        const groups = {
          laborer: {
            workers: new Set<number>(),
            attendances: 0,
            dominical: 0,
            base: 0,
            adjustments: 0,
          },
          technician: {
            workers: new Set<number>(),
            attendances: 0,
            dominical: 0,
            base: 0,
            adjustments: 0,
          },
        };
        for (const project of payroll.projects) {
          let base = 0;
          for (const entry of project.entries) {
            const worker = roster.get(entry.generalPayrollWorkerId);
            if (!worker) continue;
            const amounts = payrollAmounts(entry, worker.dailyWage);
            const group = groups[worker.group];
            if (amounts.attendances > 0) group.workers.add(worker.workerId);
            group.attendances += amounts.attendances;
            group.dominical += amounts.dominical;
            group.base += amounts.base;
            base += amounts.base;
          }
          if (permissions.finance && currency === 'PEN')
            add(key, project.projectId, 'payroll', base);
        }
        // These adjustments have no project allocation. Never repeat them per project.
        if (!query.projectId) {
          for (const worker of payroll.workers) {
            const adjustment =
              Number(worker.additionalAmount) +
              Number(worker.liquidationAmount) +
              Number(worker.sundayDinnerAmount);
            groups[worker.group].adjustments += adjustment;
            if (permissions.finance && currency === 'PEN')
              add(key, null, 'adjustments', adjustment);
          }
        }
        const rows = Object.entries(groups).map(([group, values]) => ({
          group,
          workerCount: values.workers.size,
          attendances: values.attendances,
          dominical: values.dominical,
          base: roundMoney(values.base),
          adjustments: roundMoney(values.adjustments),
          total: roundMoney(values.base + values.adjustments),
        }));
        return {
          weekId: payroll.week.weekId,
          startDate: payroll.week.startDate.toISOString().slice(0, 10),
          endDate: payroll.week.endDate.toISOString().slice(0, 10),
          includedInMonth: key === selectedKey,
          groups: rows,
          total: roundMoney(rows.reduce((sum, row) => sum + row.total, 0)),
        };
      })
      .filter(
        (week) =>
          week.endDate >= period.startDate && week.startDate < period.endDate,
      );

    const alerts: Array<{
      key: string;
      title: string;
      detail: string;
      count: number;
      severity: 'critical' | 'warning';
      href: string;
      scope: 'project' | 'global';
    }> = [];
    const addAlert = (
      key: string,
      title: string,
      detail: string,
      count: number,
      href: string,
      severity: 'critical' | 'warning' = 'warning',
      alertScope: 'project' | 'global' = 'project',
    ) => {
      if (count)
        alerts.push({
          key,
          title,
          detail,
          count,
          href,
          severity,
          scope: alertScope,
        });
    };
    const projectRows = projects.map((project) => {
      const projectTasks = tasks.filter(
        (task) => task.projectId === project.projectId,
      );
      const applicable = projectTasks.filter(
        (task) => task.status !== 'cancelled',
      );
      const completed = applicable.filter(
        (task) => task.status === 'completed',
      ).length;
      const overdueTasks = applicable.filter(
        (task) =>
          task.status !== 'completed' && task.dueDate && task.dueDate < now,
      ).length;
      const overdue =
        project.status === 'active' &&
        !!project.endDate &&
        project.endDate.toISOString().slice(0, 10) < today;
      return {
        ...project,
        endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
        progress: applicable.length
          ? Math.round((completed / applicable.length) * 100)
          : null,
        overdueTasks,
        overdue,
        pendingRequests: requests.filter(
          (request) => request.projectId === project.projectId,
        ).length,
        pendingOrders: pendingOrders.filter(
          (order) => order.projectId === project.projectId,
        ).length,
        finances: permissions.finance
          ? summarizeAmounts(projectAmounts.get(project.projectId)!)
          : null,
      };
    });
    const projectRoot = query.projectId
      ? `/admin/projects/${query.projectId}`
      : '/admin/projects';
    addAlert(
      'projects',
      'Proyectos fuera de plazo',
      'Activos con fecha de término vencida.',
      projectRows.filter((project) => project.overdue).length,
      projectRoot,
      'critical',
    );
    addAlert(
      'tasks',
      'Tareas vencidas',
      'Pendientes o en progreso, sin incluir canceladas.',
      projectRows.reduce((sum, project) => sum + project.overdueTasks, 0),
      projectRoot,
      'critical',
    );
    addAlert(
      'requests',
      'Requerimientos vencidos',
      'En progreso, revisados o aprobados con entrega vencida.',
      requests.length,
      query.projectId ? `${projectRoot}/requests` : '/admin/requests',
      'critical',
    );
    addAlert(
      'orders',
      'Órdenes pendientes antiguas',
      'Pendientes de autorización desde hace al menos 7 días.',
      pendingOrders.length,
      query.projectId ? `${projectRoot}/purchase-orders` : '/admin/projects',
    );
    addAlert(
      'emergencies',
      'Emergencias pendientes',
      'Reportes que todavía necesitan atención.',
      emergencies.length,
      query.projectId ? `${projectRoot}/emergencies` : '/admin/emergencies',
      'critical',
    );
    const expired = documents.filter(
      (document) => document.expirationDate.toISOString().slice(0, 10) < today,
    ).length;
    addAlert(
      'expired',
      'Documentos vencidos',
      'Todos los documentos vigentes en el catálogo, sin filtro de mes.',
      expired,
      '/admin/document-expirations',
      'critical',
      'global',
    );
    addAlert(
      'expiring',
      'Próximos vencimientos',
      'Documentos que vencen hoy o dentro de 30 días.',
      documents.length - expired,
      '/admin/document-expirations',
      'warning',
      'global',
    );
    const lowStock = stock.filter(
      (element) =>
        element.officeInventoryEntries.reduce(
          (sum, entry) => sum + Number(entry.currentStock),
          0,
        ) < Number(element.stockMinimum),
    ).length;
    addAlert(
      'stock',
      'Stock de oficina bajo el mínimo',
      'Elementos con mínimo configurado; solo existencias disponibles.',
      lowStock,
      '/admin/inventory',
      'warning',
      'global',
    );
    alerts.sort(
      (a, b) =>
        Number(b.severity === 'critical') - Number(a.severity === 'critical') ||
        b.count - a.count,
    );
    const current = summarizeAmounts(trend.get(selectedKey)!);
    const previous = summarizeAmounts(trend.get(period.keys[4])!);
    const payrollTotal = roundMoney(
      weeks
        .filter((week) => week.includedInMonth)
        .reduce((sum, week) => sum + week.total, 0),
    );
    return {
      statusCode: 200,
      message: 'Resumen general obtenido correctamente.',
      data: {
        generatedAt: now.toISOString(),
        permissions,
        period: { month, year, currency, projectId: query.projectId ?? null },
        projectOptions: projectOptions.map(({ projectId, code, name }) => ({
          projectId,
          code,
          name,
        })),
        activeProjects: projects.filter(
          (project) => project.status === 'active',
        ).length,
        finances: permissions.finance
          ? {
              ...current,
              previous,
              pendingPurchases: roundMoney(
                orders
                  .filter(
                    (order) =>
                      order.status === 'pending' &&
                      limaDate(order.createdAt).slice(0, 7) === selectedKey,
                  )
                  .reduce(
                    (sum, order) => sum + Number(order.purchaseAmount),
                    0,
                  ),
              ),
              trend: [...trend].map(([month, amounts]) => ({
                month,
                ...summarizeAmounts(amounts),
              })),
            }
          : null,
        payroll: permissions.payroll
          ? {
              currency: 'PEN',
              total: payrollTotal,
              projectOnly: !!query.projectId,
              weeks,
            }
          : null,
        projects: projectRows,
        alerts,
        criticalCount: alerts
          .filter((alert) => alert.severity === 'critical')
          .reduce((sum, alert) => sum + alert.count, 0),
      },
    };
  }
}
