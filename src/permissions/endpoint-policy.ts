// Explicit controller ownership. Unregistered controllers are denied, not public.
export const controllerModules: Record<string, string> = {
  DashboardController: 'dashboard',
  ProjectController: 'projects',
  TaskController: 'progress',
  SupplierController: 'suppliers',
  ClientController: 'clients',
  ResourceController: 'resources',
  CategoryResourceController: 'resources',
  PurchaseOrderConditionController: 'resources',
  PurchaseOrderController: 'orders',
  RenumberController: 'orders',
  PurchaseOrderDraftController: 'orders',
  ResourcePurchaseOrderController: 'orders',
  QuotationController: 'quotations',
  RequestController: 'requests',
  RequestFormDraftController: 'requests',
  ElementRequestController: 'requests',
  RequestWorkerController: 'requests',
  ElementRequestWorkerPlanController: 'requests',
  RequestResponseController: 'requests',
  ElementRequestResponseController: 'requests',
  ElementController: 'inventory',
  InventoryController: 'inventory',
  PettyCashController: 'cash',
  ServiceSaleController: 'incomes',
  WorkerController: 'workers',
  GeneralPayrollController: 'payroll',
  DailyWageController: 'payroll',
  WorkerMonthlyEvaluationController: 'evaluations',
  ExpiringDocumentController: 'documents',
  EmergencyController: 'emergencies',
  UserController: 'users',
  UserTypeController: 'roles',
  PermissionsController: 'roles',
};

export function endpointPermissions(
  controller: string,
  handler: string,
  method: string,
): string[][] | null {
  if (
    controller === 'NotificationController' ||
    (controller === 'UserController' &&
      ['me', 'updateMe', 'logout'].includes(handler)) ||
    (controller === 'PermissionsController' && handler === 'me')
  )
    return [];
  const module = controllerModules[controller];
  if (!module) return null;
  if (controller === 'RenumberController') {
    if (handler === 'history')
      return [['orders.view'], ['orders.renumberHistory']];
    if (['candidates', 'preview', 'apply'].includes(handler))
      return [['orders.view'], ['orders.renumber']];
    return null;
  }
  if (controller === 'RequestFormDraftController')
    return [['requests.view'], ['requests.manage']];
  if (controller === 'PurchaseOrderDraftController')
    return [['orders.view'], ['orders.manage'], ['finance.view']];
  if (controller === 'PermissionsController' && handler === 'assign')
    return [['users.view'], ['users.assignRole']];
  if (controller === 'UserTypeController' && method === 'GET')
    return [['roles.view', 'users.view', 'users.assignRole']];
  if (controller === 'GeneralPayrollController' && handler === 'save')
    return [['payroll.view'], ['payroll.attendance', 'payroll.payments']];
  if (
    controller === 'GeneralPayrollController' &&
    handler === 'updateAttendance'
  )
    return [['payroll.view'], ['payroll.attendance']];
  if (controller === 'DailyWageController')
    return [['payroll.view'], ['payroll.payments'], ['finance.view']];
  if (controller === 'InventoryController' && method !== 'GET')
    return [['inventory.view'], ['inventory.movements']];
  if (controller === 'ProjectController' && handler === 'updateStatus')
    return [['projects.view'], ['projects.status']];
  if (controller === 'RequestController' && handler === 'updateStatus')
    return [['requests.view']]; // Per-transition validation follows.
  if (
    controller === 'PurchaseOrderController' &&
    handler === 'generateProjectSummaryPdf'
  )
    return [['orders.view'], ['orders.export'], ['finance.view']];
  if (controller === 'RequestResponseController' && method !== 'GET')
    return [
      ['requests.view'],
      ['requests.review', 'requests.approve', 'requests.attend'],
    ];
  if (controller === 'ElementRequestResponseController' && method !== 'GET')
    return [
      ['requests.view'],
      ['requests.attend', 'requests.approve', 'requests.review'],
    ];
  if (
    controller === 'WorkerMonthlyEvaluationController' &&
    /^(open|close)/.test(handler)
  )
    return [['evaluations.view'], ['evaluations.close']];
  const action = /export|download|generatePdf|getPdf/i.test(handler)
    ? 'export'
    : method === 'GET'
      ? 'view'
      : method === 'DELETE'
        ? 'delete'
        : 'manage';
  return [[`${module}.view`], [`${module}.${action}`]];
}

export function satisfies(
  granted: string[],
  requirements: string[][] | null,
): boolean {
  return (
    requirements !== null &&
    requirements.every((any) => any.some((p) => granted.includes(p)))
  );
}
