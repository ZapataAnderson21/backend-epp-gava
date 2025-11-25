-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "generalConditions" SET DEFAULT 'No se especifican condiciones generales.',
ALTER COLUMN "qualityConditions" SET DEFAULT 'No se especifican condiciones de calidad.',
ALTER COLUMN "quotation" SET DEFAULT 'No se especifica cotización.';

-- AlterTable
ALTER TABLE "Worker" ALTER COLUMN "address" SET DEFAULT 'Sin dirección especificada.';
