export enum PurchaseOrderType {
  Materials = 'materials',
  Services = 'services',
}
export const PurchaseOrderTypeLabelEs: Record<PurchaseOrderType, string> = {
  [PurchaseOrderType.Materials]: 'Materiales',
  [PurchaseOrderType.Services]: 'Servicios',
};