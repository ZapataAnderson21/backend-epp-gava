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
  StaffPayrollController: 'staffPayroll',
  WorkerMonthlyEvaluationController: 'evaluations',
  ExpiringDocumentController: 'documents',
  EmergencyController: 'emergencies',
  SsomaController: 'ssoma',
  WorkClothingController: 'workClothing',
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
  if (controller === 'SsomaController') {
    const specialAction: Record<string, string> = {
      sign: 'sign',
      captureSignature: 'sign',
      closeTalk: 'close',
      startRevision: 'revise',
      publishRevision: 'revise',
      downloadCurrentPdf: 'export',
      downloadVersionPdf: 'export',
      reconcilePublications: 'audit',
      getRetentionStatus: 'audit',
      getRetentionOrphanReport: 'audit',
      runRetentionMaintenance: 'manage',
      setRetentionHold: 'manage',
      clearRetentionHold: 'manage',
      invalidateAttendance: 'invalidate',
      close: 'close',
      revise: 'revise',
      annulTalk: 'void',
      auditHistory: 'audit',
      export: 'export',
    };
    if (
      [
        'createTalk',
        'updateDraft',
        'startTalk',
        'openTalk',
        'addParticipants',
        'removeParticipant',
      ].includes(handler)
    )
      return [['ssoma.view'], ['ssoma.manage']];
    if (
      [
        'listTalks',
        'findTalk',
        'searchWorkers',
        'getAvailability',
        'listDocumentVersions',
        'listRevisions',
      ].includes(handler)
    )
      return [['ssoma.view']];
    const action = specialAction[handler];
    if (action) return [['ssoma.view'], [`ssoma.${action}`]];
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
  if (controller === 'StaffPayrollController') {
    const requirements = [['staffPayroll.view'], ['finance.view']];
    if (handler === 'exportPeriod')
      return [...requirements, ['staffPayroll.export']];
    if (method !== 'GET') return [...requirements, ['staffPayroll.manage']];
    return requirements;
  }
  if (controller === 'WorkClothingController') {
    if (handler === 'deliveryPdf')
      return [['workClothing.view'], ['workClothing.export']];
    if (handler === 'createDispatch')
      return [['workClothing.view'], ['workClothing.dispatch']];
    if (handler === 'receiveDispatch')
      return [['workClothing.view'], ['workClothing.receive']];
    if (handler === 'createDelivery')
      return [['workClothing.view'], ['workClothing.deliver']];
    if (handler === 'annulDelivery')
      return [['workClothing.view'], ['workClothing.cancel']];
    if (handler === 'confirmReturn')
      return [
        ['workClothing.view'],
        ['workClothing.return'],
        ['workClothing.dispatch', 'workClothing.manage'],
      ];
    if (['createReturn', 'cancelReturn'].includes(handler))
      return [['workClothing.view'], ['workClothing.return']];
    if (method === 'GET') return [['workClothing.view']];
    return [['workClothing.view'], ['workClothing.manage']];
  }
  if (controller === 'InventoryController' && method !== 'GET')
    return [['inventory.view'], ['inventory.movements']];
  if (controller === 'ProjectController' && handler === 'updateStatus')
    return [['projects.view'], ['projects.status']];
  if (controller === 'RequestController' && handler === 'updateStatus')
    return [['requests.view']]; // Per-transition validation follows.
  if (controller === 'RequestController' && handler === 'addResource')
    return [['requests.view'], ['requests.addResource']];
  if (controller === 'RequestController' && handler === 'sendToLogistics')
    return [['requests.view'], ['requests.sendEmail']];
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
