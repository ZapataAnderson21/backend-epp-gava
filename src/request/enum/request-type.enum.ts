export const RequestType = {
  Epp: 'epp',
  Operative: 'operative',
  EppAndOperative: 'eppAndOperative',
} as const;

export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const RequestTypeLabelEs: Record<RequestType, string> = {
  [RequestType.Epp]: 'EPP',
  [RequestType.Operative]: 'Operativo',
  [RequestType.EppAndOperative]: 'EPP y Operativo',
};
