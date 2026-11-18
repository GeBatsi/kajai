-- Nullable columns preserve all existing users and require no backfill.
ALTER TABLE "users"
ADD COLUMN "bannedAt" TIMESTAMP(3),
ADD COLUMN "banReason" TEXT;
