export enum EmergencyStatus {
  Pending = 'pending',
  Addressed = 'addressed',
  Rejected = 'rejected',
}
export const EmergencyStatusLabelEs: Record<EmergencyStatus, string> = {
  [EmergencyStatus.Pending]: 'Pendiente',
  [EmergencyStatus.Addressed]: 'Atendida',
  [EmergencyStatus.Rejected]: 'Rechazada',
};
