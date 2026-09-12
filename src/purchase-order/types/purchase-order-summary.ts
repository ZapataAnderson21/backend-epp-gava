import { PurchaseOrderStatus, PurchaseOrderType } from '../enum';
import { Currency } from 'src/supplier/enum/currency.enum';

export interface PurchaseOrderSummaryAmount {
  purchaseAmount: number;
  saleAmount: number;
  margin: number;
}

export interface PurchaseOrderSummaryRow extends PurchaseOrderSummaryAmount {
  purchaseOrderId: number;
  code: string;
  supplierId: number;
  supplierName: string;
  purchaseOrderType: PurchaseOrderType;
  purchaseOrderTypeLabel: string;
  currency: Currency;
  status: PurchaseOrderStatus;
  statusLabel: string;
}

export interface PurchaseOrderProjectSummary {
  project: {
    projectId: number;
    code: string;
    name: string;
  };
  filters: {
    search: string | null;
    supplierId: number | null;
    supplierName: string | null;
    currency: Currency | null;
    status: PurchaseOrderStatus | null;
    purchaseOrderType: PurchaseOrderType | null;
  };
  totals: {
    totalOrders: number;
    activeOrders: number;
    cancelledOrders: number;
    byCurrency: Record<Currency, PurchaseOrderSummaryAmount>;
  };
  orders: PurchaseOrderSummaryRow[];
}
