import { Currency, CurrencyLabelEs } from '../supplier/enum/currency.enum';

interface SupplierAccountDetails {
  accountNumber?: string | null;
  bank?: string | null;
  currency?: string | null;
}

export function formatSupplierAccountDetails(
  supplier?: SupplierAccountDetails | null,
) {
  const bank = supplier?.bank?.trim() ?? '';
  const currencyCode = supplier?.currency;
  const currency = currencyCode
    ? CurrencyLabelEs[currencyCode as Currency] || currencyCode
    : '';
  const accountNumber = supplier?.accountNumber?.trim() ?? '';
  const bankDetails = [bank, currency ? `(${currency})` : '']
    .filter(Boolean)
    .join(' ');

  return [bankDetails, accountNumber || 'Cuenta no registrada']
    .filter(Boolean)
    .join(' - ');
}
