export enum RequestStatus {
  Draft = 'draft',
  InProgress = 'inProgress',
  Reviewed = 'reviewed',
  Approved = 'approved',
  Rejected = 'rejected',
  Addressed = 'addressed',
  Completed = 'completed',
}
export const RequestStatusLabelEs: Record<RequestStatus, string> = {
  [RequestStatus.Draft]: 'Borrador',
  [RequestStatus.InProgress]: 'En progreso',
  [RequestStatus.Reviewed]: 'Revisada',
  [RequestStatus.Approved]: 'Aprobada',
  [RequestStatus.Rejected]: 'Rechazada',
  [RequestStatus.Addressed]: 'Atendida',
  [RequestStatus.Completed]: 'Completada',
};