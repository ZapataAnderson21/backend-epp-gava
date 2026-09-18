CREATE TABLE "RequestFormDraft" (
    "userId" INTEGER NOT NULL,
    "slot" VARCHAR(24) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestFormDraft_pkey" PRIMARY KEY ("userId", "slot"),
    CONSTRAINT "RequestFormDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
