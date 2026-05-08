ALTER TABLE "ElementRequestResponse"
ADD COLUMN "selectedElementIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
