\set ON_ERROR_STOP on

-- Usage: psql "$SSOMA_DATABASE_URL" -v ssoma_audit_role='caller_supplied_role' -f this-file.sql
-- Preconditions: run as a privileged deployment operator against the intended database after
-- the SSOMA migration; the supplied role exists, is not an owner, and has no role memberships;
-- PUBLIC has no database CREATE/TEMP grants and no grants on the audit table or identity sequence.
-- This contract creates no role and contains no production role name or credential.
\if :{?ssoma_audit_role}
\else
  \echo 'Required psql variable missing: -v ssoma_audit_role=<existing role identifier>'
  \quit 3
\endif

SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'ssoma_audit_role') AS ssoma_role_exists,
       NOT EXISTS (
         SELECT 1
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.oid IN (
             'public."SsomaTalkAuditEvent"'::regclass,
             pg_get_serial_sequence('public."SsomaTalkAuditEvent"', 'ssomaTalkAuditEventId')::regclass
           )
           AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = :'ssoma_audit_role')
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_namespace n
         WHERE n.nspname = 'public'
           AND n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = :'ssoma_audit_role')
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_database d
         WHERE d.datname = current_database()
           AND d.datdba = (SELECT oid FROM pg_roles WHERE rolname = :'ssoma_audit_role')
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_auth_members m
         WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = :'ssoma_audit_role')
            OR m.roleid = (SELECT oid FROM pg_roles WHERE rolname = :'ssoma_audit_role')
       )
       AND NOT EXISTS (
         SELECT 1
         FROM pg_class c
         CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END, c.relowner))) a
         WHERE c.oid IN (
           'public."SsomaTalkAuditEvent"'::regclass,
           pg_get_serial_sequence('public."SsomaTalkAuditEvent"', 'ssomaTalkAuditEventId')::regclass
         )
           AND a.grantee = 0
       )
       AND NOT EXISTS (
         SELECT 1
         FROM pg_database d
         CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d'::"char", d.datdba))) a
         WHERE d.datname = current_database()
           AND a.grantee = 0
           AND a.privilege_type IN ('CREATE', 'TEMP')
       ) AS ssoma_preconditions_ok
\gset

\if :ssoma_role_exists
\else
  \echo 'Supplied SSOMA audit role does not exist.'
  \quit 3
\endif
\if :ssoma_preconditions_ok
\else
  \echo 'Role ownership or membership violates the SSOMA audit privilege contract preconditions.'
  \quit 3
\endif

SELECT current_database() AS ssoma_database \gset

ALTER ROLE :"ssoma_audit_role"
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION NOINHERIT;

REVOKE ALL PRIVILEGES ON DATABASE :"ssoma_database" FROM :"ssoma_audit_role";
GRANT CONNECT ON DATABASE :"ssoma_database" TO :"ssoma_audit_role";
REVOKE ALL PRIVILEGES ON SCHEMA public FROM :"ssoma_audit_role";
GRANT USAGE ON SCHEMA public TO :"ssoma_audit_role";

REVOKE ALL PRIVILEGES ON TABLE public."SsomaTalkAuditEvent" FROM :"ssoma_audit_role";
GRANT SELECT, INSERT ON TABLE public."SsomaTalkAuditEvent" TO :"ssoma_audit_role";

REVOKE ALL PRIVILEGES ON SEQUENCE public."SsomaTalkAuditEvent_ssomaTalkAuditEventId_seq" FROM :"ssoma_audit_role";
GRANT USAGE ON SEQUENCE public."SsomaTalkAuditEvent_ssomaTalkAuditEventId_seq" TO :"ssoma_audit_role";

-- Deliberately withheld: UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, sequence SELECT/UPDATE,
-- ownership, schema CREATE, database CREATE/TEMP, and role memberships.
