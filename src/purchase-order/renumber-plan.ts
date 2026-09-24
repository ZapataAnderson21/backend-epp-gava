import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface NumberedOrder {
  purchaseOrderId: number;
  code: string;
  updatedAt: Date;
  status: string;
  project: { name: string };
  supplier: { name: string };
}
export function numberingFingerprint(rows: NumberedOrder[]) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [...rows].sort((a, b) => a.purchaseOrderId - b.purchaseOrderId),
      ),
    )
    .digest('hex');
}
export function buildRenumberPlan(
  rows: NumberedOrder[],
  ids: number[],
  year: number,
  start: number,
) {
  if (
    !ids.length ||
    ids.length > 100 ||
    new Set(ids).size !== ids.length ||
    !Number.isSafeInteger(start) ||
    start < 1 ||
    start + ids.length > 1000000000
  ) {
    throw new BadRequestException(
      'Selecciona entre 1 y 100 órdenes distintas y un correlativo inicial válido.',
    );
  }
  const parsed = rows.map((row) => {
    const match = /^No\s+(\d+)-(\d{4})(\/.+\/[^/]+)$/.exec(row.code);
    if (!match || Number(match[2]) !== year)
      throw new ConflictException(`Código no reconocido: ${row.code}`);
    return { ...row, number: Number(match[1]), suffix: match[3] };
  });
  if (new Set(parsed.map((row) => row.number)).size !== parsed.length)
    throw new ConflictException(
      'Existen correlativos repetidos en este año. Deben revisarse antes de corregir.',
    );
  const selected = parsed
    .filter((row) => ids.includes(row.purchaseOrderId))
    .sort((a, b) => a.number - b.number);
  if (selected.length !== ids.length)
    throw new ConflictException(
      'Alguna OC ya no existe o pertenece a otro año.',
    );
  const changes = selected.map((row, index) => {
    const number = start + index;
    const conflict = parsed.find(
      (other) =>
        other.number === number && !ids.includes(other.purchaseOrderId),
    );
    if (conflict)
      throw new ConflictException(
        `El número ${number} está ocupado por ${conflict.code}. Incluye esa OC en la selección o elige otro inicio.`,
      );
    return {
      purchaseOrderId: row.purchaseOrderId,
      before: row.code,
      after: `No ${String(number).padStart(3, '0')}-${year}${row.suffix}`,
      project: row.project.name,
      supplier: row.supplier.name,
      status: row.status,
      number,
    };
  });
  if (changes.every((row) => row.before === row.after))
    throw new BadRequestException(
      'La selección no produce cambios de numeración.',
    );
  return {
    changes,
    nextNumber:
      Math.max(
        0,
        ...parsed
          .filter((row) => !ids.includes(row.purchaseOrderId))
          .map((row) => row.number),
        ...changes.map((row) => row.number),
      ) + 1,
  };
}
