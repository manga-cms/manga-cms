-- Runtime production rights grants.
-- These grants control CMS/admin production permissions and are separate from
-- reader entitlements and canonical contents/ manga data.

-- CreateTable
CREATE TABLE "RightsGrant" (
    "grantId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "seriesId" TEXT,
    "episodeId" TEXT,
    "language" TEXT,
    "packId" TEXT,
    "territory" TEXT,
    "usageJson" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "grantedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RightsGrant_pkey" PRIMARY KEY ("grantId")
);

-- CreateIndex
CREATE INDEX "RightsGrant_subjectUserId_idx" ON "RightsGrant"("subjectUserId");

-- CreateIndex
CREATE INDEX "RightsGrant_seriesId_idx" ON "RightsGrant"("seriesId");

-- CreateIndex
CREATE INDEX "RightsGrant_subjectUserId_seriesId_idx" ON "RightsGrant"("subjectUserId", "seriesId");

-- CreateIndex
CREATE INDEX "RightsGrant_revokedAt_idx" ON "RightsGrant"("revokedAt");
