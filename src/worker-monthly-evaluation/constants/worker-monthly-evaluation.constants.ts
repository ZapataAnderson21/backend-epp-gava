export const MONTHLY_EVALUATION_ALLOWED_USER_TYPES = [
  'GERENTE',
  'ADMINISTRADORA',
  'PREVENCIONISTA DE RIESGOS',
] as const;

export const MONTHLY_EVALUATION_STATUS_MANAGEMENT_USER_TYPES = [
  'GERENTE',
  'ADMINISTRADORA',
] as const;

export const SCORE_MIN = 0;
export const SCORE_MAX = 3;

export const PERFORMANCE_LABELS = {
  observed: 'Trabajador observado.',
  improvable: 'Bien, pero puede mejorar.',
  excellent: 'Excelente Trabajador.',
} as const;
