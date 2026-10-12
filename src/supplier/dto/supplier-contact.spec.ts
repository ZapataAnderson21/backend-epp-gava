import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';
import { UpdateSupplierDto } from './update-supplier.dto';

describe('Supplier optional contact', () => {
  const base = {
    name: 'Supplier',
    abbreviation: 'SUP',
    contactName: 'Contact',
    ruc: '20123456789',
    accountNumber: '1234567890123',
    bank: 'BCP',
  };

  for (const Dto of [CreateSupplierDto, UpdateSupplierDto]) {
    describe(Dto.name, () => {
      it.each([undefined, null, '', '   '])(
        'accepts absent contacts: %p',
        (value) => {
          const dto = plainToInstance(Dto, {
            ...base,
            phone: value,
            email: value,
          });
          expect(validateSync(dto)).toEqual([]);
        },
      );

      it('leaves omitted fields undefined for partial updates', () => {
        const dto = plainToInstance(Dto, base);
        expect(dto.phone).toBeUndefined();
        expect(dto.email).toBeUndefined();
        expect(validateSync(dto)).toEqual([]);
      });

      it('normalizes blank contacts to null to clear existing values', () => {
        const dto = plainToInstance(Dto, { ...base, phone: ' ', email: '' });
        expect(dto.phone).toBeNull();
        expect(dto.email).toBeNull();
      });

      it('accepts and trims valid supplied contacts', () => {
        const dto = plainToInstance(Dto, {
          ...base,
          phone: ' 987654321 ',
          email: ' a@example.com ',
        });
        expect(validateSync(dto)).toEqual([]);
        expect(dto.phone).toBe('987654321');
        expect(dto.email).toBe('a@example.com');
      });

      it.each(['123', '1234567890', 987654321])(
        'rejects invalid supplied phone: %p',
        (phone) => {
          expect(
            validateSync(plainToInstance(Dto, { ...base, phone })).some(
              (e) => e.property === 'phone',
            ),
          ).toBe(true);
        },
      );

      it('rejects an invalid supplied email', () => {
        expect(
          validateSync(
            plainToInstance(Dto, { ...base, email: 'invalid' }),
          ).some((e) => e.property === 'email'),
        ).toBe(true);
      });
    });
  }
});
