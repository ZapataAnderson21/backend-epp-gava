export enum PaymentMethod {
  Deposit = 'deposit',
  Transfer = 'transfer',
}
export const PaymentMethodLabelEs: Record<PaymentMethod, string> = {
  [PaymentMethod.Deposit]: 'Depósito',
  [PaymentMethod.Transfer]: 'Transferencia',
};
