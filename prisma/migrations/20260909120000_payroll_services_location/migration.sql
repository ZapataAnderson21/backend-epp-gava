BEGIN;
CREATE TYPE "GeneralPayrollLocationType" AS ENUM ('project', 'services');
ALTER TABLE "GeneralPayrollProject"
  ALTER COLUMN "projectId" DROP NOT NULL,
  ADD COLUMN "locationType" "GeneralPayrollLocationType" NOT NULL DEFAULT 'project';

-- Services is a weekly payroll location, never a Project record.
ALTER TABLE "GeneralPayrollProject" ADD CONSTRAINT "payroll_location_project_check"
  CHECK (("locationType" = 'project' AND "projectId" IS NOT NULL)
      OR ("locationType" = 'services' AND "projectId" IS NULL));
-- NULL project IDs cannot enforce uniqueness via the existing composite index.
CREATE UNIQUE INDEX "GeneralPayrollProject_one_services_per_week"
  ON "GeneralPayrollProject" ("generalPayrollId") WHERE "locationType" = 'services';
COMMIT;
