import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import { ElementService } from './element.service';
import {
  ElementControlType,
  ElementFamily,
  ElementFamilyRequiresCode,
  ElementFamilyReturnsToOffice,
  ElementFamilyUsesUniqueInventory,
  ElementType,
} from './enum/element-type.enum';

type PayloadResolver = {
  resolveElementPayload: (
    dto: Record<string, unknown>,
    current?: {
      elementId: number;
      family: string | null;
      type: string | null;
      controlType: string | null;
      code: string | null;
    },
  ) => {
    family: string | null;
    type: string | null;
    controlType: string;
  };
};

describe('ElementService - clasificación Fase 5', () => {
  const prisma = Object.create(PrismaService.prototype) as PrismaService;
  const service = new ElementService(prisma) as unknown as PayloadResolver;

  it.each([
    ElementFamily.ElectricalEquipment,
    ElementFamily.Tools,
    ElementFamily.Ladders,
    ElementFamily.ElectricalHarness,
  ])('configura %s como activo individual retornable', (family) => {
    expect(ElementFamilyUsesUniqueInventory[family]).toBe(true);
    expect(ElementFamilyReturnsToOffice[family]).toBe(true);
    expect(ElementFamilyRequiresCode[family]).toBe(true);

    const payload = service.resolveElementPayload({
      family,
      code: `${family}-001`,
    });
    expect(payload).toMatchObject({
      family,
      type: ElementType.Operative,
      controlType: ElementControlType.Individual,
    });
  });

  it('configura Materiales como stock consumible no retornable', () => {
    expect(ElementFamilyUsesUniqueInventory[ElementFamily.Materials]).toBe(
      false,
    );
    expect(ElementFamilyReturnsToOffice[ElementFamily.Materials]).toBe(false);
    expect(ElementFamilyRequiresCode[ElementFamily.Materials]).toBe(false);

    expect(
      service.resolveElementPayload({ family: ElementFamily.Materials }),
    ).toMatchObject({
      family: ElementFamily.Materials,
      type: ElementType.Operative,
      controlType: ElementControlType.Consumable,
    });
  });

  it('permite distinguir Equipos de Seguridad consumibles', () => {
    expect(
      service.resolveElementPayload({
        family: ElementFamily.Ese,
        controlType: ElementControlType.Consumable,
      }),
    ).toMatchObject({
      family: ElementFamily.Ese,
      controlType: ElementControlType.Consumable,
    });
  });

  it('preserva el control ESE en una actualización parcial', () => {
    const payload = service.resolveElementPayload(
      { name: 'Kit absorbente actualizado' },
      {
        elementId: 12,
        family: ElementFamily.Ese,
        type: ElementType.Operative,
        controlType: ElementControlType.Consumable,
        code: null,
      },
    );

    expect(payload.controlType).toBe(ElementControlType.Consumable);
  });

  it('usa una migración estrictamente aditiva y sin reclasificación masiva', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20261118183000_add_inventory_phase5_families/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('ALTER TYPE "ElementFamily" ADD VALUE');
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });
});
