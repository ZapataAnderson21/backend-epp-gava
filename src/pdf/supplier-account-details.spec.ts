import { formatSupplierAccountDetails } from './supplier-account-details';

describe('formatSupplierAccountDetails', () => {
  it('formats a registered account', () => {
    expect(
      formatSupplierAccountDetails({
        bank: 'BCP',
        currency: 'PEN',
        accountNumber: '1234567890123',
      }),
    ).toBe('BCP (Soles) - 1234567890123');
  });

  it.each([undefined, null, '', '   '])(
    'reports an absent account without dangling punctuation: %p',
    (accountNumber) => {
      expect(
        formatSupplierAccountDetails({
          bank: 'BCP',
          currency: 'PEN',
          accountNumber,
        }),
      ).toBe('BCP (Soles) - Cuenta no registrada');
    },
  );
});
