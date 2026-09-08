import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

const financialKeys =
  /^(amount|price|cost|totalPEN|totalUSD|totalEUR|totalAmount|totalCost|totalPayment|totalNet|purchaseAmount|saleAmount|purchasePrice|salePrice|unitPrice|unitValue|dailyWage|dailyWages|overtimeAmount|afpDiscount|advanceDiscount|additionalAmount|liquidationAmount|sundayDinnerAmount|gross|net|netBase|netFinal|base|final|grossPay|netPay|weeklyPayment|weeklyPay|margin|profit|income|expenses|finances|financials|payrollTotal|salary|unitPurchasePrice|unitSalePrice)$/i;
const moneyField = (key: string) =>
  financialKeys.test(key) ||
  /amount|price|cost|wage|discount|salary|payment|profit|margin/i.test(key) ||
  /^(finalNet|adjustments|afp|advance|additional|liquidation|sundayDinner|totalPEN|totalUSD|totalEUR)$/i.test(
    key,
  );
const relations: Record<string, string> = {
  purchaseOrders: 'orders',
  requests: 'requests',
  emergencies: 'emergencies',
  serviceSales: 'incomes',
  pettyCashes: 'cash',
  dailyWages: 'payroll',
  workerMonthlyEvaluations: 'evaluations',
};
export function redactFinancial(
  value: unknown,
  granted?: string[],
  parent = '',
): unknown {
  if (Array.isArray(value))
    return value.map((item) => redactFinancial(item, granted, parent));
  if (!value || typeof value !== 'object' || value instanceof Date)
    return value;
  // Leave Prisma Decimal and buffers to their own serializers.
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => {
        if (
          granted &&
          relations[key] &&
          !granted.includes(`${relations[key]}.view`)
        )
          return false;
        return (
          granted?.includes('finance.view') ||
          (!moneyField(key) &&
            !(
              key === 'total' && ['payroll', 'weeks', 'groups'].includes(parent)
            ))
        );
      })
      .map(([key, item]) => [key, redactFinancial(item, granted, key)]),
  );
}
@Injectable()
export class FinancialInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<{ permissions?: string[] }>();
    return next
      .handle()
      .pipe(map((data: unknown) => redactFinancial(data, request.permissions)));
  }
}
