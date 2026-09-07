import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';
import { UpdateSupplierDto } from './update-supplier.dto';

describe('Supplier abbreviation validation', () => {
  const validSupplier = {
    name: 'Proveedor SAC',
    contactName: 'Contacto',
    phone: '999999999',
    ruc: '20123456789',
    accountNumber: '1234567890123',
    bank: 'BCP',
  };

  it('normaliza la entrada manual y acepta abreviaturas no derivadas del nombre', () => {
    const dto = plainToInstance(CreateSupplierDto, {
      ...validSupplier,
      abbreviation: '  alt12  ',
    });
    expect(dto.abbreviation).toBe('ALT12');
    expect(validateSync(dto)).toEqual([]);
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    'DOS PAL',
    'A/B',
    'ÁBC',
    '123456789',
    123,
  ])('rechaza la abreviatura inválida %p al crear', (abbreviation) => {
    const dto = plainToInstance(CreateSupplierDto, {
      ...validSupplier,
      abbreviation,
    });
    expect(
      validateSync(dto).some((error) => error.property === 'abbreviation'),
    ).toBe(true);
  });

  it('permite actualizar otros campos sin cambiar la abreviatura', () => {
    expect(
      validateSync(
        plainToInstance(UpdateSupplierDto, { name: 'Nuevo nombre' }),
      ),
    ).toEqual([]);
  });

  it('normaliza la abreviatura al editar', () => {
    const dto = plainToInstance(UpdateSupplierDto, { abbreviation: ' abc ' });
    expect(dto.abbreviation).toBe('ABC');
    expect(validateSync(dto)).toEqual([]);
  });

  it.each([null, '', '   ', 'A/B', '123456789'])(
    'no permite borrar la abreviatura con %p al editar',
    (abbreviation) => {
      const dto = plainToInstance(UpdateSupplierDto, { abbreviation });
      expect(
        validateSync(dto).some((error) => error.property === 'abbreviation'),
      ).toBe(true);
    },
  );
});
