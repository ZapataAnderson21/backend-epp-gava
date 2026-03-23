export enum RequestStatus {
  draft = 'draft',
  inProgress = 'inProgress',
  reviewed = 'reviewed',
  approved = 'approved',
  rejected = 'rejected',
  addressed = 'addressed',
  completed = 'completed',
}
export const RequestStatusLabelEs: Record<RequestStatus, string> = {
  [RequestStatus.draft]: 'Borrador',
  [RequestStatus.inProgress]: 'En progreso',
  [RequestStatus.reviewed]: 'Revisada',
  [RequestStatus.approved]: 'Aprobada',
  [RequestStatus.rejected]: 'Rechazada',
  [RequestStatus.addressed]: 'Atendida',
  [RequestStatus.completed]: 'Completada',
};
