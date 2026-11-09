import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';
import { UpdateSupplierDto } from './update-supplier.dto';

describe('Supplier optional account number', () => {
  const base = {
    name: 'Supplier',
    abbreviation: 'SUP',
    contactName: 'Contact',
    ruc: '20123456789',
    bank: 'BCP',
  };

  for (const Dto of [CreateSupplierDto, UpdateSupplierDto]) {
    describe(Dto.name, () => {
      it.each([undefined, null, '', '   '])(
        'accepts an absent account number: %p',
        (value) => {
          const dto = plainToInstance(Dto, {
            ...base,
            accountNumber: value,
          });

          expect(validateSync(dto)).toEqual([]);
          if (value === null || value === '' || value === '   ') {
            expect(dto.accountNumber).toBeNull();
          }
        },
      );

      it('accepts and trims a valid supplied account number', () => {
        const dto = plainToInstance(Dto, {
          ...base,
          accountNumber: ' 1234567890123 ',
        });

        expect(validateSync(dto)).toEqual([]);
        expect(dto.accountNumber).toBe('1234567890123');
      });

      it.each(['123456789012', '123456789012345678901', '1234-567890123'])(
        'rejects an invalid supplied account number: %p',
        (accountNumber) => {
          expect(
            validateSync(plainToInstance(Dto, { ...base, accountNumber })).some(
              (error) => error.property === 'accountNumber',
            ),
          ).toBe(true);
        },
      );
    });
  }
});
