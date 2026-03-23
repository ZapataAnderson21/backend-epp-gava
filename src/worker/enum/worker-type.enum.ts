export enum WorkerType {
  Laborer = 'laborer',
  Technician = 'technician',
  Engineer = 'engineer',
  Administrator = 'administrator',
  Manager = 'manager',
  Unspecified = 'unspecified',
}

export const WorkerTypeLabelEs: Record<WorkerType, string> = {
  [WorkerType.Laborer]: 'Obrero',
  [WorkerType.Technician]: 'Técnico',
  [WorkerType.Engineer]: 'Ingeniero',
  [WorkerType.Administrator]: 'Administrador(a)',
  [WorkerType.Manager]: 'Gerente',
  [WorkerType.Unspecified]: 'No Especificado',
};
