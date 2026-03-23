export enum PurchaseOrderStatus {
  Pending = 'pending',
  Authorized = 'authorized',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}
export const PurchaseOrderStatusLabelEs: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Pending]: 'Pendiente',
  [PurchaseOrderStatus.Authorized]: 'Autorizada',
  [PurchaseOrderStatus.Delivered]: 'Entregada',
  [PurchaseOrderStatus.Cancelled]: 'Cancelada',
};
