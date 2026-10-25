import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as ts from 'typescript';
import {
  allPermissions,
  initialPermissions,
  normalizePermissions,
} from './catalog';
import { endpointPermissions, satisfies } from './endpoint-policy';
import { redactFinancial } from './financial.interceptor';
import { dashboardPermissions } from '../dashboard/dashboard-calculations';

describe('Dynamic role permissions', () => {
  it('registers the SSOMA permission surface and grants it to the PDR role', () => {
    const ssomaPermissions = [
      'ssoma.view',
      'ssoma.manage',
      'ssoma.sign',
      'ssoma.invalidate',
      'ssoma.close',
      'ssoma.revise',
      'ssoma.void',
      'ssoma.export',
      'ssoma.audit',
    ];
    expect(ssomaPermissions.every((permission) => allPermissions.includes(permission))).toBe(true);
    expect(initialPermissions('PREVENCIONISTA DE RIESGOS')).toEqual(
      expect.arrayContaining(ssomaPermissions),
    );
    const migration = readFileSync(
      resolve(__dirname, '../../prisma/migrations/20261025_add_ssoma_phase3/migration.sql'),
      'utf8',
    );
    for (const permission of ssomaPermissions)
      expect(migration).toContain(`'${permission}'`);
  });
  it('uses action-specific permissions for SSOMA talk operations', () => {
    const cases = [
      ['listTalks', 'GET', 'ssoma.view'],
      ['createTalk', 'POST', 'ssoma.manage'],
      ['findTalk', 'GET', 'ssoma.view'],
      ['updateDraft', 'PATCH', 'ssoma.manage'],
      ['startTalk', 'POST', 'ssoma.manage'],
      ['openTalk', 'POST', 'ssoma.manage'],
      ['annulTalk', 'POST', 'ssoma.void'],
      ['searchWorkers', 'GET', 'ssoma.view'],
      ['getAvailability', 'GET', 'ssoma.view'],
      ['addParticipants', 'POST', 'ssoma.manage'],
      ['removeParticipant', 'POST', 'ssoma.manage'],
      ['invalidateAttendance', 'POST', 'ssoma.invalidate'],
      ['auditHistory', 'GET', 'ssoma.audit'],
      ['sign', 'POST', 'ssoma.sign'],
      ['close', 'POST', 'ssoma.close'],
      ['revise', 'POST', 'ssoma.revise'],
      ['export', 'GET', 'ssoma.export'],
    ] as const;
    for (const [handler, method, permission] of cases) {
      expect(
        satisfies(
          ['ssoma.view', permission],
          endpointPermissions('SsomaController', handler, method),
        ),
      ).toBe(true);
    }
    expect(
      satisfies(['ssoma.view', 'ssoma.manage'], endpointPermissions('SsomaController', 'sign', 'POST')),
    ).toBe(false);
    expect(endpointPermissions('SsomaController', 'unknown', 'GET')).toBeNull();
  });
  it('normalizes dependencies and rejects unknown privileges', () => {
    expect(normalizePermissions(['payroll.payments'])).toEqual([
      'finance.view',
      'payroll.payments',
      'payroll.view',
    ]);
    expect(normalizePermissions(['workers.delete', 'workers.delete'])).toEqual([
      'workers.delete',
      'workers.view',
    ]);
    expect(() => normalizePermissions(['anything.admin'])).toThrow();
  });
  it('keeps every seeded role nonempty and reserves permission administration', () => {
    for (const name of [
      'GERENTE',
      'ADMINISTRADORA',
      'ADMINISTRADOR',
      'LOGISTICA',
      'PREVENCIONISTA DE RIESGOS',
      'SISTEMAS',
      'OTHER',
    ]) {
      const permissions = initialPermissions(name);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every((p) => allPermissions.includes(p))).toBe(true);
      const sql = readFileSync(
        resolve(
          __dirname,
          '../../prisma/migrations/20260908120000_dynamic_role_permissions/migration.sql',
        ),
        'utf8',
      );
      const seeded =
        name === 'OTHER'
          ? sql.match(/ELSE ARRAY\[([^\]]*)\]/)?.[1]
          : sql.match(
              new RegExp(`WHEN '${name}' THEN ARRAY\\[([^\\]]*)\\]`),
            )?.[1];
      const historicalPermissions = seeded?.replaceAll("'", '').split(',');
      expect(
        historicalPermissions?.filter((p) => !p.startsWith('ssoma.')),
      ).toEqual(
        permissions.filter((p) => !p.startsWith('ssoma.')),
      );
    }
    expect(initialPermissions('LOGISTICA')).not.toContain('roles.manage');
  });
  it('separates reading, editing and deleting', () => {
    expect(
      satisfies(
        ['workers.view'],
        endpointPermissions('WorkerController', 'findAll', 'GET'),
      ),
    ).toBe(true);
    expect(
      satisfies(
        ['workers.view'],
        endpointPermissions('WorkerController', 'update', 'PATCH'),
      ),
    ).toBe(false);
    expect(
      satisfies(
        ['workers.view', 'workers.manage'],
        endpointPermissions('WorkerController', 'remove', 'DELETE'),
      ),
    ).toBe(false);
    expect(
      satisfies(
        allPermissions,
        endpointPermissions('UnknownController', 'findAll', 'GET'),
      ),
    ).toBe(false);
  });
  it('separates payroll configuration and data entry', () => {
    expect(
      satisfies(
        ['payroll.view', 'payroll.attendance'],
        endpointPermissions(
          'GeneralPayrollController',
          'updateAttendance',
          'PATCH',
        ),
      ),
    ).toBe(true);
    expect(
      satisfies(
        ['payroll.view', 'payroll.payments'],
        endpointPermissions(
          'GeneralPayrollController',
          'updateAttendance',
          'PATCH',
        ),
      ),
    ).toBe(false);
    expect(
      satisfies(
        ['payroll.view', 'payroll.manage'],
        endpointPermissions('GeneralPayrollController', 'save', 'PUT'),
      ),
    ).toBe(false);
    expect(
      satisfies(
        ['payroll.view', 'payroll.attendance'],
        endpointPermissions('GeneralPayrollController', 'save', 'PUT'),
      ),
    ).toBe(true);
    expect(
      satisfies(
        ['evaluations.view', 'evaluations.manage'],
        endpointPermissions(
          'WorkerMonthlyEvaluationController',
          'closeEvaluation',
          'POST',
        ),
      ),
    ).toBe(false);
  });
  it('requires finance access to export the purchase order summary', () => {
    const policy = endpointPermissions(
      'PurchaseOrderController',
      'generateProjectSummaryPdf',
      'GET',
    );
    expect(satisfies(['orders.view', 'orders.export'], policy)).toBe(false);
    expect(
      satisfies(['orders.view', 'orders.export', 'finance.view'], policy),
    ).toBe(true);
  });
  it('removes nested money and denied modules without removing attendance', () => {
    const input = {
      data: {
        workers: [
          {
            fullName: 'Test',
            paidAmount: 50,
            grossAmount: 60,
            dailyWage: 10,
            attendance: { monday: true },
            attendanceCount: 1,
          },
        ],
        purchaseOrders: [{ code: 'OC', saleAmount: 10 }],
      },
    };
    expect(redactFinancial(input, ['payroll.view'])).toEqual({
      data: {
        workers: [
          {
            fullName: 'Test',
            attendance: { monday: true },
            attendanceCount: 1,
          },
        ],
      },
    });
    expect(redactFinancial(input, ['finance.view', 'orders.view'])).toEqual(
      input,
    );
  });
  it('does not use role names to authorize dashboard sources', () => {
    expect(dashboardPermissions(['GERENTE']).finance).toBe(false);
    expect(dashboardPermissions(allPermissions).finance).toBe(true);
    expect(dashboardPermissions(['dashboard.view']).inventory).toBe(false);
  });
  it('assigns a valid policy to every non-public HTTP handler', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() && e.name !== 'generated'
          ? walk(join(dir, e.name))
          : e.isFile() && e.name.endsWith('.controller.ts')
            ? [join(dir, e.name)]
            : [],
      );
    let count = 0;
    for (const file of walk(resolve(__dirname, '..'))) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const node of tree.statements.filter(ts.isClassDeclaration))
        for (const method of node.members.filter(ts.isMethodDeclaration)) {
          const decorators = ts.getDecorators(method) ?? [];
          const names = decorators.map((d) =>
            ts.isCallExpression(d.expression)
              ? d.expression.expression.getText(tree)
              : d.expression.getText(tree),
          );
          const verb = names.find((n) =>
            ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(n),
          );
          if (!verb || names.includes('Public')) continue;
          const policy = endpointPermissions(
            node.name!.text,
            method.name.getText(tree),
            verb.toUpperCase(),
          );
          expect({
            handler: `${node.name!.text}.${method.name.getText(tree)}`,
            valid:
              policy !== null &&
              policy.flat().every((p) => allPermissions.includes(p)),
          }).toEqual({
            handler: `${node.name!.text}.${method.name.getText(tree)}`,
            valid: true,
          });
          count++;
        }
    }
    expect(count).toBeGreaterThan(100);
  });
});
