-- @idempotent
BEGIN;

CREATE TEMP TABLE "_deprecated_element_ids" ON COMMIT DROP AS
SELECT "elementId"
FROM "Element"
WHERE "family"::text IN ('eq_safety', 'consumible');

CREATE TEMP TABLE "_deprecated_element_request_ids" ON COMMIT DROP AS
SELECT "elementRequestId"
FROM "ElementRequest"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids");

CREATE TEMP TABLE "_deprecated_project_entry_ids" ON COMMIT DROP AS
SELECT "projectInventoryEntryId"
FROM "ProjectInventoryEntry"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids")
   OR "elementRequestId" IN (
     SELECT "elementRequestId" FROM "_deprecated_element_request_ids"
   );

CREATE TEMP TABLE "_deprecated_office_entry_ids" ON COMMIT DROP AS
SELECT "officeInventoryEntryId"
FROM "OfficeInventoryEntry"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids");

CREATE TEMP TABLE "_deprecated_asset_ids" ON COMMIT DROP AS
SELECT "inventoryAssetId"
FROM "InventoryAsset"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids")
   OR "officeInventoryEntryId" IN (
     SELECT "officeInventoryEntryId" FROM "_deprecated_office_entry_ids"
   );

CREATE TEMP TABLE "_deprecated_worker_assignment_ids" ON COMMIT DROP AS
SELECT "workerInventoryAssignmentId"
FROM "WorkerInventoryAssignment"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids")
   OR "inventoryAssetId" IN (
     SELECT "inventoryAssetId" FROM "_deprecated_asset_ids"
   )
   OR "sourceProjectInventoryEntryId" IN (
     SELECT "projectInventoryEntryId" FROM "_deprecated_project_entry_ids"
   );

DELETE FROM "InventoryMovement"
WHERE "elementId" IN (SELECT "elementId" FROM "_deprecated_element_ids")
   OR "projectInventoryEntryId" IN (
     SELECT "projectInventoryEntryId" FROM "_deprecated_project_entry_ids"
   )
   OR "officeInventoryEntryId" IN (
     SELECT "officeInventoryEntryId" FROM "_deprecated_office_entry_ids"
   )
   OR "inventoryAssetId" IN (
     SELECT "inventoryAssetId" FROM "_deprecated_asset_ids"
   )
   OR "workerInventoryAssignmentId" IN (
     SELECT "workerInventoryAssignmentId" FROM "_deprecated_worker_assignment_ids"
   );

DELETE FROM "WorkerInventoryAssignment"
WHERE "workerInventoryAssignmentId" IN (
  SELECT "workerInventoryAssignmentId" FROM "_deprecated_worker_assignment_ids"
);

DELETE FROM "HarnessAssetProfile"
WHERE "inventoryAssetId" IN (
  SELECT "inventoryAssetId" FROM "_deprecated_asset_ids"
);

DELETE FROM "MeasurementAssetProfile"
WHERE "inventoryAssetId" IN (
  SELECT "inventoryAssetId" FROM "_deprecated_asset_ids"
);

DELETE FROM "InventoryAsset"
WHERE "inventoryAssetId" IN (
  SELECT "inventoryAssetId" FROM "_deprecated_asset_ids"
);

DELETE FROM "ProjectInventoryEntry"
WHERE "projectInventoryEntryId" IN (
  SELECT "projectInventoryEntryId" FROM "_deprecated_project_entry_ids"
);

DELETE FROM "OfficeInventoryEntry"
WHERE "officeInventoryEntryId" IN (
  SELECT "officeInventoryEntryId" FROM "_deprecated_office_entry_ids"
);

DELETE FROM "ElementRequestWorkerPlan"
WHERE "elementRequestId" IN (
  SELECT "elementRequestId" FROM "_deprecated_element_request_ids"
);

DELETE FROM "ElementRequestResponse"
WHERE "elementRequestId" IN (
  SELECT "elementRequestId" FROM "_deprecated_element_request_ids"
);

DELETE FROM "ElementRequest"
WHERE "elementRequestId" IN (
  SELECT "elementRequestId" FROM "_deprecated_element_request_ids"
);

DELETE FROM "ElementVariant"
WHERE "elementId" IN (
  SELECT "elementId" FROM "_deprecated_element_ids"
);

DELETE FROM "Element"
WHERE "elementId" IN (
  SELECT "elementId" FROM "_deprecated_element_ids"
);

COMMIT;
