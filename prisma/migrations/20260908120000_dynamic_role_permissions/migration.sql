BEGIN;
ALTER TABLE "UserType" ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
UPDATE "UserType" SET "permissions" = CASE "name"
 WHEN 'GERENTE' THEN ARRAY['cash.delete','cash.export','cash.manage','cash.view','clients.delete','clients.manage','clients.view','dashboard.view','documents.delete','documents.manage','documents.view','emergencies.manage','emergencies.view','evaluations.close','evaluations.export','evaluations.manage','evaluations.view','finance.view','incomes.delete','incomes.manage','incomes.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','orders.authorize','orders.delete','orders.export','orders.manage','orders.view','payroll.attendance','payroll.export','payroll.manage','payroll.payments','payroll.view','progress.delete','progress.manage','progress.view','projects.delete','projects.manage','projects.status','projects.view','quotations.export','quotations.manage','quotations.view','requests.approve','requests.attend','requests.delete','requests.export','requests.manage','requests.review','requests.view','resources.delete','resources.export','resources.manage','resources.view','roles.manage','roles.view','suppliers.delete','suppliers.manage','suppliers.view','users.assignRole','users.delete','users.manage','users.view','workers.delete','workers.manage','workers.view']::text[]
 WHEN 'ADMINISTRADORA' THEN ARRAY['cash.delete','cash.export','cash.manage','cash.view','clients.delete','clients.manage','clients.view','dashboard.view','documents.delete','documents.manage','documents.view','emergencies.manage','emergencies.view','evaluations.close','evaluations.export','evaluations.manage','evaluations.view','finance.view','incomes.delete','incomes.manage','incomes.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','orders.authorize','orders.delete','orders.export','orders.manage','orders.view','payroll.attendance','payroll.export','payroll.manage','payroll.payments','payroll.view','progress.delete','progress.manage','progress.view','projects.delete','projects.manage','projects.status','projects.view','quotations.export','quotations.manage','quotations.view','requests.approve','requests.attend','requests.delete','requests.export','requests.manage','requests.review','requests.view','resources.delete','resources.export','resources.manage','resources.view','roles.manage','roles.view','suppliers.delete','suppliers.manage','suppliers.view','users.assignRole','users.delete','users.manage','users.view','workers.delete','workers.manage','workers.view']::text[]
 WHEN 'ADMINISTRADOR' THEN ARRAY['cash.delete','cash.export','cash.manage','cash.view','clients.delete','clients.manage','clients.view','dashboard.view','emergencies.manage','emergencies.view','finance.view','incomes.delete','incomes.manage','incomes.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','orders.delete','orders.export','orders.manage','orders.view','payroll.attendance','payroll.export','payroll.manage','payroll.payments','payroll.view','progress.view','projects.view','quotations.export','quotations.manage','quotations.view','requests.attend','requests.delete','requests.export','requests.manage','requests.review','requests.view','resources.delete','resources.export','resources.manage','resources.view','suppliers.delete','suppliers.manage','suppliers.view','users.assignRole','users.delete','users.manage','users.view','workers.delete','workers.manage','workers.view']::text[]
 WHEN 'LOGISTICA' THEN ARRAY['clients.delete','clients.manage','clients.view','dashboard.view','documents.delete','documents.manage','documents.view','emergencies.manage','emergencies.view','finance.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','orders.delete','orders.export','orders.manage','orders.view','payroll.attendance','payroll.export','payroll.manage','payroll.payments','payroll.view','progress.view','projects.view','quotations.export','quotations.manage','quotations.view','requests.attend','requests.delete','requests.export','requests.manage','requests.view','resources.delete','resources.export','resources.manage','resources.view','suppliers.delete','suppliers.manage','suppliers.view','workers.delete','workers.manage','workers.view']::text[]
 WHEN 'PREVENCIONISTA DE RIESGOS' THEN ARRAY['dashboard.view','documents.delete','documents.manage','documents.view','emergencies.manage','emergencies.view','evaluations.export','evaluations.manage','evaluations.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','progress.view','projects.view','requests.delete','requests.export','requests.manage','requests.view','workers.view']::text[]
 WHEN 'SISTEMAS' THEN ARRAY['dashboard.view','emergencies.manage','emergencies.view','inventory.delete','inventory.manage','inventory.movements','inventory.view','progress.view','projects.view','requests.delete','requests.export','requests.manage','requests.view','workers.view']::text[]
 ELSE ARRAY['dashboard.view','emergencies.manage','emergencies.view','inventory.view','progress.view','projects.view','requests.delete','requests.export','requests.manage','requests.view','workers.view']::text[] END;
-- At least one existing administrator must be available; never silently pick a user.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE "deletedAt" IS NULL)
 AND NOT EXISTS (SELECT 1 FROM "UserUserType" l JOIN "User" u USING ("userId")
 JOIN "UserType" r USING ("userTypeId") WHERE u."deletedAt" IS NULL AND 'roles.manage' = ANY(r.permissions))
 THEN RAISE EXCEPTION 'Assign an active user to GERENTE or ADMINISTRADORA before migrating permissions';
 END IF;
END $$;
-- Lock and validate ALL mutation paths, including the legacy user-disable endpoint.
CREATE FUNCTION rbac_lock_admin_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_advisory_xact_lock(71823091); RETURN NULL; END $$;
CREATE FUNCTION rbac_preserve_administrator() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "UserUserType" l JOIN "User" u USING ("userId")
 JOIN "UserType" r USING ("userTypeId") WHERE u."deletedAt" IS NULL AND 'roles.manage' = ANY(r.permissions))
 THEN RAISE EXCEPTION 'Debe quedar al menos un usuario activo que administre permisos'
 USING ERRCODE = '23514', CONSTRAINT = 'rbac_last_administrator'; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER rbac_role_lock BEFORE UPDATE OR DELETE ON "UserType"
 FOR EACH STATEMENT EXECUTE FUNCTION rbac_lock_admin_changes();
CREATE TRIGGER rbac_link_lock BEFORE INSERT OR UPDATE OR DELETE ON "UserUserType"
 FOR EACH STATEMENT EXECUTE FUNCTION rbac_lock_admin_changes();
CREATE TRIGGER rbac_user_lock BEFORE UPDATE OR DELETE ON "User"
 FOR EACH STATEMENT EXECUTE FUNCTION rbac_lock_admin_changes();
CREATE CONSTRAINT TRIGGER rbac_role_admin AFTER UPDATE OR DELETE ON "UserType"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rbac_preserve_administrator();
CREATE CONSTRAINT TRIGGER rbac_link_admin AFTER UPDATE OR DELETE ON "UserUserType"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rbac_preserve_administrator();
CREATE CONSTRAINT TRIGGER rbac_user_admin AFTER UPDATE OR DELETE ON "User"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rbac_preserve_administrator();
COMMIT;
