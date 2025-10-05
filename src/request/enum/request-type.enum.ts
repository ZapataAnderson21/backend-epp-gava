export enum RequestType {
  Epp = 'epp',
  Operative = 'operative',
  EppAndOperative = 'eppAndOperative',
}
export const RequestTypeLabelEs: Record<RequestType, string> = {
  [RequestType.Epp]: 'EPP',
  [RequestType.Operative]: 'Operativo',
  [RequestType.EppAndOperative]: 'EPP y Operativo',
};