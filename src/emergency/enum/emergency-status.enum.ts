export const EmergencyStatus = {
  Pending: 'pending',
  Addressed: 'addressed',
  Rejected: 'rejected',
} as const;

export type EmergencyStatus =
  (typeof EmergencyStatus)[keyof typeof EmergencyStatus];
export const EmergencyStatusLabelEs: Record<EmergencyStatus, string> = {
  [EmergencyStatus.Pending]: 'Pendiente',
  [EmergencyStatus.Addressed]: 'Atendida',
  [EmergencyStatus.Rejected]: 'Rechazada',
};
