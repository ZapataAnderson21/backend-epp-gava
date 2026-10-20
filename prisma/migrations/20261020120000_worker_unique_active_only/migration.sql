-- DropIndex
DROP INDEX "Worker_dni_key";

-- DropIndex
DROP INDEX "Worker_phone_key";

-- DropIndex
DROP INDEX "Worker_personalEmail_key";

-- CreateIndex
CREATE INDEX "Worker_phone_idx" ON "Worker"("phone");

-- CreateIndex
CREATE INDEX "Worker_personalEmail_idx" ON "Worker"("personalEmail");
