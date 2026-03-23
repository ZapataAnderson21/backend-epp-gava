export enum ProjectStatus {
  Active = 'active',
  Inactive = 'inactive',
  Completed = 'completed',
}
export const ProjectStatusLabelEs: Record<ProjectStatus, string> = {
  [ProjectStatus.Active]: 'Activo',
  [ProjectStatus.Inactive]: 'Inactivo',
  [ProjectStatus.Completed]: 'Completado',
};
