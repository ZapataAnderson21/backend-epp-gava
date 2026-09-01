ALTER TABLE "ServiceSale"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'PEN';

CREATE INDEX "ServiceSale_projectId_currency_idx"
ON "ServiceSale"("projectId", "currency");
