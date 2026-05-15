WITH ranked AS (
  SELECT
    "elementRequestResponseId",
    ROW_NUMBER() OVER (
      PARTITION BY "elementRequestId", "requestResponseId"
      ORDER BY "updatedAt" DESC, "elementRequestResponseId" DESC
    ) AS row_number
  FROM "ElementRequestResponse"
)
DELETE FROM "ElementRequestResponse"
WHERE "elementRequestResponseId" IN (
  SELECT "elementRequestResponseId"
  FROM ranked
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "ElementRequestResponse_elementRequestId_requestResponseId_key"
ON "ElementRequestResponse"("elementRequestId", "requestResponseId");
