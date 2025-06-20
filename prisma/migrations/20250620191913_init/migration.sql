-- CreateTable
CREATE TABLE "User" (
    "user_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserType" (
    "user_type_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserType_pkey" PRIMARY KEY ("user_type_id")
);

-- CreateTable
CREATE TABLE "UserUserType" (
    "user_user_type_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_type_id" INTEGER NOT NULL,

    CONSTRAINT "UserUserType_pkey" PRIMARY KEY ("user_user_type_id")
);

-- CreateTable
CREATE TABLE "Project" (
    "project_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Sin descripción',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "Element" (
    "element_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Sin descripción',

    CONSTRAINT "Element_pkey" PRIMARY KEY ("element_id")
);

-- CreateTable
CREATE TABLE "Request" (
    "request_id" SERIAL NOT NULL,
    "registration_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "ElementRequest" (
    "element_request_id" SERIAL NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "element_id" INTEGER NOT NULL,
    "request_id" INTEGER NOT NULL,

    CONSTRAINT "ElementRequest_pkey" PRIMARY KEY ("element_request_id")
);

-- CreateTable
CREATE TABLE "RequestResponse" (
    "request_response_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "responder_user_id" INTEGER NOT NULL,
    "response_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "RequestResponse_pkey" PRIMARY KEY ("request_response_id")
);

-- CreateTable
CREATE TABLE "ElementRequestResponse" (
    "element_request_response_id" SERIAL NOT NULL,
    "element_request_id" INTEGER NOT NULL,
    "request_response_id" INTEGER NOT NULL,
    "quantity_accepted" INTEGER NOT NULL,

    CONSTRAINT "ElementRequestResponse_pkey" PRIMARY KEY ("element_request_response_id")
);

-- AddForeignKey
ALTER TABLE "UserUserType" ADD CONSTRAINT "UserUserType_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUserType" ADD CONSTRAINT "UserUserType_user_type_id_fkey" FOREIGN KEY ("user_type_id") REFERENCES "UserType"("user_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "Element"("element_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_responder_user_id_fkey" FOREIGN KEY ("responder_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_element_request_id_fkey" FOREIGN KEY ("element_request_id") REFERENCES "ElementRequest"("element_request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_request_response_id_fkey" FOREIGN KEY ("request_response_id") REFERENCES "RequestResponse"("request_response_id") ON DELETE RESTRICT ON UPDATE CASCADE;
