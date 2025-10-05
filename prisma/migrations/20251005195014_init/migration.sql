-- Emails case-insensitive
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'inactive', 'completed');

-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('epp', 'operative');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'inProgress', 'reviewed', 'approved', 'rejected', 'addressed', 'completed');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('epp', 'operative', 'eppAndOperative');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('pending', 'addressed', 'rejected');

-- CreateEnum
CREATE TYPE "PurchaseOrderType" AS ENUM ('materials', 'services');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'PEN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('deposit', 'transfer');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'authorized', 'delivered', 'cancelled');

-- CreateTable
CREATE TABLE "User" (
    "userId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserType" (
    "userTypeId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserType_pkey" PRIMARY KEY ("userTypeId")
);

-- CreateTable
CREATE TABLE "UserUserType" (
    "userUserTypeId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userTypeId" INTEGER NOT NULL,

    CONSTRAINT "UserUserType_pkey" PRIMARY KEY ("userUserTypeId")
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'No description provided.',
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "Element" (
    "elementId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'No description provided.',
    "type" "ElementType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Element_pkey" PRIMARY KEY ("elementId")
);

-- CreateTable
CREATE TABLE "Request" (
    "requestId" SERIAL NOT NULL,
    "deliveryDueDate" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "description" TEXT NOT NULL DEFAULT 'No description provided.',
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "type" "RequestType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "RequestWorker" (
    "requestWorkerId" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "shoeSize" TEXT NOT NULL,
    "pantsSize" TEXT NOT NULL,
    "shirtSize" TEXT NOT NULL,
    "workerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestWorker_pkey" PRIMARY KEY ("requestWorkerId")
);

-- CreateTable
CREATE TABLE "ElementRequest" (
    "elementRequestId" SERIAL NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "elementId" INTEGER NOT NULL,
    "requestId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementRequest_pkey" PRIMARY KEY ("elementRequestId")
);

-- CreateTable
CREATE TABLE "RequestResponse" (
    "requestResponseId" SERIAL NOT NULL,
    "responderUserId" INTEGER NOT NULL,
    "requestId" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestResponse_pkey" PRIMARY KEY ("requestResponseId")
);

-- CreateTable
CREATE TABLE "ElementRequestResponse" (
    "elementRequestResponseId" SERIAL NOT NULL,
    "elementRequestId" INTEGER NOT NULL,
    "requestResponseId" INTEGER NOT NULL,
    "quantityAccepted" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementRequestResponse_pkey" PRIMARY KEY ("elementRequestResponseId")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emergency" (
    "emergencyId" SERIAL NOT NULL,
    "image" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emergency_pkey" PRIMARY KEY ("emergencyId")
);

-- CreateTable
CREATE TABLE "Worker" (
    "workerId" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT 'No address provided.',
    "workerGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "WorkerGroup" (
    "workerGroupId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentGroupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerGroup_pkey" PRIMARY KEY ("workerGroupId")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "supplierId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'PEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("supplierId")
);

-- CreateTable
CREATE TABLE "CategoryResource" (
    "categoryResourceId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentCategoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryResource_pkey" PRIMARY KEY ("categoryResourceId")
);

-- CreateTable
CREATE TABLE "Resource" (
    "resourceId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryResourceId" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("resourceId")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "purchaseOrderId" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "deliveryLocation" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "paymentConditions" TEXT NOT NULL,
    "generalConditions" TEXT NOT NULL DEFAULT 'No general conditions specified.',
    "qualityConditions" TEXT NOT NULL DEFAULT 'No quality conditions specified.',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "saleAmount" DECIMAL(18,2) NOT NULL,
    "purchaseAmount" DECIMAL(18,2) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
    "carePerson" TEXT NOT NULL,
    "dniCarePerson" VARCHAR(8) NOT NULL,
    "observations" TEXT NOT NULL DEFAULT 'No observations provided.',
    "projectId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "logisticsManager" TEXT NOT NULL DEFAULT 'Morayma Lloja Fernandez',
    "authorizer" TEXT NOT NULL DEFAULT 'Henrry Gayoso Valdera',
    "administrativeManager" TEXT NOT NULL DEFAULT 'Angi Gonzales Cotrina',
    "quotation" TEXT NOT NULL DEFAULT 'No quotation provided.',
    "purchaseOrderType" "PurchaseOrderType" NOT NULL DEFAULT 'materials',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("purchaseOrderId")
);

-- CreateTable
CREATE TABLE "ResourcePurchaseOrder" (
    "resourcePurchaseOrderId" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitSalesPrice" DECIMAL(18,2) NOT NULL,
    "unitPurchasePrice" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourcePurchaseOrder_pkey" PRIMARY KEY ("resourcePurchaseOrderId")
);

-- CreateTable
CREATE TABLE "PettyCash" (
    "pettyCashId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "resourceName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'No description provided',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCash_pkey" PRIMARY KEY ("pettyCashId")
);

-- CreateTable
CREATE TABLE "ServiceSale" (
    "serviceSaleId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "serviceName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'No description provided',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSale_pkey" PRIMARY KEY ("serviceSaleId")
);

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "BlacklistedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_lastName_idx" ON "User"("lastName");

-- CreateIndex
CREATE UNIQUE INDEX "UserType_name_key" ON "UserType"("name");

-- CreateIndex
CREATE INDEX "UserUserType_userTypeId_idx" ON "UserUserType"("userTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUserType_userId_userTypeId_key" ON "UserUserType"("userId", "userTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Element_type_idx" ON "Element"("type");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_type_idx" ON "Request"("type");

-- CreateIndex
CREATE INDEX "Request_projectId_idx" ON "Request"("projectId");

-- CreateIndex
CREATE INDEX "Request_userId_idx" ON "Request"("userId");

-- CreateIndex
CREATE INDEX "Request_deliveryDueDate_idx" ON "Request"("deliveryDueDate");

-- CreateIndex
CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");

-- CreateIndex
CREATE INDEX "RequestWorker_requestId_idx" ON "RequestWorker"("requestId");

-- CreateIndex
CREATE INDEX "RequestWorker_workerId_idx" ON "RequestWorker"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestWorker_requestId_workerId_key" ON "RequestWorker"("requestId", "workerId");

-- CreateIndex
CREATE INDEX "ElementRequest_elementId_idx" ON "ElementRequest"("elementId");

-- CreateIndex
CREATE INDEX "ElementRequest_requestId_idx" ON "ElementRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementRequest_requestId_elementId_key" ON "ElementRequest"("requestId", "elementId");

-- CreateIndex
CREATE INDEX "RequestResponse_responderUserId_idx" ON "RequestResponse"("responderUserId");

-- CreateIndex
CREATE INDEX "RequestResponse_requestId_idx" ON "RequestResponse"("requestId");

-- CreateIndex
CREATE INDEX "ElementRequestResponse_elementRequestId_idx" ON "ElementRequestResponse"("elementRequestId");

-- CreateIndex
CREATE INDEX "ElementRequestResponse_requestResponseId_idx" ON "ElementRequestResponse"("requestResponseId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Emergency_status_idx" ON "Emergency"("status");

-- CreateIndex
CREATE INDEX "Emergency_userId_idx" ON "Emergency"("userId");

-- CreateIndex
CREATE INDEX "Emergency_projectId_idx" ON "Emergency"("projectId");

-- CreateIndex
CREATE INDEX "Emergency_createdAt_idx" ON "Emergency"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_dni_key" ON "Worker"("dni");

-- CreateIndex
CREATE INDEX "Worker_dni_idx" ON "Worker"("dni");

-- CreateIndex
CREATE INDEX "Worker_workerGroupId_idx" ON "Worker"("workerGroupId");

-- CreateIndex
CREATE INDEX "WorkerGroup_parentGroupId_idx" ON "WorkerGroup"("parentGroupId");

-- CreateIndex
CREATE INDEX "WorkerGroup_name_idx" ON "WorkerGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerGroup_parentGroupId_name_key" ON "WorkerGroup"("parentGroupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_email_key" ON "Supplier"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_ruc_key" ON "Supplier"("ruc");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_createdAt_idx" ON "Supplier"("createdAt");

-- CreateIndex
CREATE INDEX "CategoryResource_parentCategoryId_idx" ON "CategoryResource"("parentCategoryId");

-- CreateIndex
CREATE INDEX "CategoryResource_name_idx" ON "CategoryResource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryResource_parentCategoryId_name_key" ON "CategoryResource"("parentCategoryId", "name");

-- CreateIndex
CREATE INDEX "Resource_categoryResourceId_idx" ON "Resource"("categoryResourceId");

-- CreateIndex
CREATE INDEX "Resource_name_idx" ON "Resource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_categoryResourceId_name_key" ON "Resource"("categoryResourceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ResourcePurchaseOrder_resourceId_idx" ON "ResourcePurchaseOrder"("resourceId");

-- CreateIndex
CREATE INDEX "ResourcePurchaseOrder_purchaseOrderId_idx" ON "ResourcePurchaseOrder"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourcePurchaseOrder_purchaseOrderId_resourceId_key" ON "ResourcePurchaseOrder"("purchaseOrderId", "resourceId");

-- CreateIndex
CREATE INDEX "PettyCash_projectId_idx" ON "PettyCash"("projectId");

-- CreateIndex
CREATE INDEX "PettyCash_createdAt_idx" ON "PettyCash"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceSale_projectId_idx" ON "ServiceSale"("projectId");

-- CreateIndex
CREATE INDEX "ServiceSale_createdAt_idx" ON "ServiceSale"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- AddForeignKey
ALTER TABLE "UserUserType" ADD CONSTRAINT "UserUserType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUserType" ADD CONSTRAINT "UserUserType_userTypeId_fkey" FOREIGN KEY ("userTypeId") REFERENCES "UserType"("userTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestWorker" ADD CONSTRAINT "RequestWorker_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestWorker" ADD CONSTRAINT "RequestWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_responderUserId_fkey" FOREIGN KEY ("responderUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_elementRequestId_fkey" FOREIGN KEY ("elementRequestId") REFERENCES "ElementRequest"("elementRequestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_requestResponseId_fkey" FOREIGN KEY ("requestResponseId") REFERENCES "RequestResponse"("requestResponseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_workerGroupId_fkey" FOREIGN KEY ("workerGroupId") REFERENCES "WorkerGroup"("workerGroupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerGroup" ADD CONSTRAINT "WorkerGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "WorkerGroup"("workerGroupId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryResource" ADD CONSTRAINT "CategoryResource_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "CategoryResource"("categoryResourceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_categoryResourceId_fkey" FOREIGN KEY ("categoryResourceId") REFERENCES "CategoryResource"("categoryResourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("supplierId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePurchaseOrder" ADD CONSTRAINT "ResourcePurchaseOrder_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("resourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePurchaseOrder" ADD CONSTRAINT "ResourcePurchaseOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("purchaseOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCash" ADD CONSTRAINT "PettyCash_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSale" ADD CONSTRAINT "ServiceSale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlacklistedToken" ADD CONSTRAINT "BlacklistedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;


/* ===== Cantidades y montos no negativos (idempotente) ===== */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_elementrequest_quantityRequested_nonneg') THEN
    ALTER TABLE "ElementRequest"
      ADD CONSTRAINT "chk_elementrequest_quantityRequested_nonneg"
      CHECK ("quantityRequested" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_elreqresp_quantityAccepted_nonneg') THEN
    ALTER TABLE "ElementRequestResponse"
      ADD CONSTRAINT "chk_elreqresp_quantityAccepted_nonneg"
      CHECK ("quantityAccepted" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rpo_quantity_nonneg') THEN
    ALTER TABLE "ResourcePurchaseOrder"
      ADD CONSTRAINT "chk_rpo_quantity_nonneg"
      CHECK ("quantity" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rpo_unitSalesPrice_nonneg') THEN
    ALTER TABLE "ResourcePurchaseOrder"
      ADD CONSTRAINT "chk_rpo_unitSalesPrice_nonneg"
      CHECK ("unitSalesPrice" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rpo_unitPurchasePrice_nonneg') THEN
    ALTER TABLE "ResourcePurchaseOrder"
      ADD CONSTRAINT "chk_rpo_unitPurchasePrice_nonneg"
      CHECK ("unitPurchasePrice" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_purchaseorder_saleAmount_nonneg') THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "chk_purchaseorder_saleAmount_nonneg"
      CHECK ("saleAmount" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_purchaseorder_purchaseAmount_nonneg') THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "chk_purchaseorder_purchaseAmount_nonneg"
      CHECK ("purchaseAmount" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pettycash_amount_nonneg') THEN
    ALTER TABLE "PettyCash"
      ADD CONSTRAINT "chk_pettycash_amount_nonneg"
      CHECK ("amount" >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_servicesale_amount_nonneg') THEN
    ALTER TABLE "ServiceSale"
      ADD CONSTRAINT "chk_servicesale_amount_nonneg"
      CHECK ("amount" >= 0);
  END IF;
END$$;
