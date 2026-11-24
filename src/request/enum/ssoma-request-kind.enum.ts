export const SsomaRequestKind = {
  ProjectStart: 'projectStart',
  DuringExecution: 'duringExecution',
} as const;

export type SsomaRequestKind =
  (typeof SsomaRequestKind)[keyof typeof SsomaRequestKind];

export const SsomaRequestKindLabelEs: Record<SsomaRequestKind, string> = {
  [SsomaRequestKind.ProjectStart]: 'Inicio de Obra',
  [SsomaRequestKind.DuringExecution]: 'Durante la Ejecución',
};
