export const permissionModules = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'], special: [] },
  {
    key: 'projects',
    label: 'Proyectos',
    actions: ['view', 'manage', 'delete'],
    special: [['status', 'Cambiar estado']],
  },
  {
    key: 'progress',
    label: 'Avance y tareas',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'suppliers',
    label: 'Proveedores',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'clients',
    label: 'Clientes',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'resources',
    label: 'Recursos de órdenes de compra',
    actions: ['view', 'manage', 'delete', 'export'],
    special: [],
  },
  {
    key: 'orders',
    label: 'Órdenes de compra',
    actions: ['view', 'manage', 'delete', 'export'],
    special: [['authorize', 'Autorizar / cancelar']],
  },
  {
    key: 'quotations',
    label: 'Cotizaciones',
    actions: ['view', 'manage', 'export'],
    special: [],
  },
  {
    key: 'requests',
    label: 'Requerimientos',
    actions: ['view', 'manage', 'delete', 'export'],
    special: [
      ['review', 'Revisar'],
      ['approve', 'Aprobar / rechazar'],
      ['attend', 'Atender'],
    ],
  },
  {
    key: 'inventory',
    label: 'Inventario',
    actions: ['view', 'manage', 'delete'],
    special: [['movements', 'Registrar movimientos']],
  },
  {
    key: 'cash',
    label: 'Caja chica',
    actions: ['view', 'manage', 'delete', 'export'],
    special: [],
  },
  {
    key: 'incomes',
    label: 'Ingresos',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'workers',
    label: 'Trabajadores',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'payroll',
    label: 'Planillas',
    actions: ['view', 'manage', 'export'],
    special: [
      ['attendance', 'Registrar asistencias'],
      ['payments', 'Modificar pagos'],
    ],
  },
  {
    key: 'evaluations',
    label: 'Evaluaciones mensuales',
    actions: ['view', 'manage', 'export'],
    special: [['close', 'Cerrar / reabrir']],
  },
  {
    key: 'documents',
    label: 'Vencimientos',
    actions: ['view', 'manage', 'delete'],
    special: [],
  },
  {
    key: 'emergencies',
    label: 'Emergencias',
    actions: ['view', 'manage'],
    special: [],
  },
  {
    key: 'users',
    label: 'Usuarios',
    actions: ['view', 'manage', 'delete'],
    special: [['assignRole', 'Asignar roles']],
  },
  {
    key: 'roles',
    label: 'Configuración de permisos',
    actions: ['view', 'manage'],
    special: [],
  },
  {
    key: 'finance',
    label: 'Información económica',
    actions: ['view'],
    special: [],
  },
] as const;

export const allPermissions: string[] = permissionModules.flatMap((module) => [
  ...module.actions.map((action) => `${module.key}.${action}`),
  ...module.special.map(([action]) => `${module.key}.${action}`),
]);

export const permissionDependencies: Record<string, string[]> =
  Object.fromEntries(
    allPermissions.map((permission) => [
      permission,
      [
        ...(permission.endsWith('.view')
          ? []
          : [`${permission.split('.')[0]}.view`]),
        ...([
          'payroll.payments',
          'orders.manage',
          'quotations.manage',
          'cash.manage',
          'incomes.manage',
          'orders.export',
          'quotations.export',
          'cash.export',
          'payroll.export',
        ].includes(permission)
          ? ['finance.view']
          : []),
      ],
    ]),
  );

export function normalizePermissions(input: string[]): string[] {
  if (input.some((permission) => !allPermissions.includes(permission))) {
    throw new Error(
      'El catálogo contiene permisos desconocidos. Actualiza la página.',
    );
  }
  const result = new Set(input);
  for (const permission of input)
    for (const dependency of permissionDependencies[permission])
      result.add(dependency);
  return [...result].sort();
}

// Used once by the migration; runtime authorization never depends on role names.
export function initialPermissions(name: string): string[] {
  if (['GERENTE', 'ADMINISTRADORA'].includes(name))
    return [...allPermissions].sort();
  const permissions = [
    'dashboard.view',
    'projects.view',
    'progress.view',
    'requests.view',
    'requests.manage',
    'requests.delete',
    'requests.export',
    'inventory.view',
    'workers.view',
    'emergencies.view',
    'emergencies.manage',
  ];
  if (['ADMINISTRADOR', 'LOGISTICA'].includes(name)) {
    for (const module of [
      'suppliers',
      'clients',
      'resources',
      'orders',
      'quotations',
      'workers',
      'payroll',
    ]) {
      permissions.push(
        ...allPermissions.filter(
          (p) => p.startsWith(`${module}.`) && p !== 'orders.authorize',
        ),
      );
    }
    permissions.push(
      'inventory.manage',
      'inventory.delete',
      'inventory.movements',
      'requests.attend',
      'finance.view',
    );
  }
  if (name === 'ADMINISTRADOR')
    permissions.push(
      'requests.review',
      'users.view',
      'users.manage',
      'users.delete',
      'users.assignRole',
      'cash.view',
      'cash.manage',
      'cash.delete',
      'cash.export',
      'incomes.view',
      'incomes.manage',
      'incomes.delete',
    );
  if (['LOGISTICA', 'PREVENCIONISTA DE RIESGOS'].includes(name))
    permissions.push('documents.view', 'documents.manage', 'documents.delete');
  if (['PREVENCIONISTA DE RIESGOS', 'SISTEMAS'].includes(name))
    permissions.push(
      'inventory.manage',
      'inventory.delete',
      'inventory.movements',
    );
  if (name === 'PREVENCIONISTA DE RIESGOS')
    permissions.push(
      'evaluations.view',
      'evaluations.manage',
      'evaluations.export',
    );
  return normalizePermissions(permissions);
}
