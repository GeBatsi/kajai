CREATE TYPE "NutritionCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "food_nutrition_corrections" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "originalNutrition" JSONB,
    "proposedNutrition" JSONB NOT NULL,
    "foodUpdatedAt" TIMESTAMP(3) NOT NULL,
    "foodAuditVersion" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "NutritionCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "food_nutrition_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_nutrition_corrections_status_submittedAt_id_idx" ON "food_nutrition_corrections"("status", "submittedAt", "id");
CREATE INDEX "food_nutrition_corrections_foodItemId_submittedAt_id_idx" ON "food_nutrition_corrections"("foodItemId", "submittedAt", "id");
CREATE INDEX "food_nutrition_corrections_submittedById_submittedAt_id_idx" ON "food_nutrition_corrections"("submittedById", "submittedAt", "id");
CREATE INDEX "food_nutrition_corrections_reviewedById_idx" ON "food_nutrition_corrections"("reviewedById");
CREATE UNIQUE INDEX "food_nutrition_corrections_pending_submitter_key"
    ON "food_nutrition_corrections"("foodItemId", "submittedById")
    WHERE "status" = 'PENDING' AND "foodItemId" IS NOT NULL AND "submittedById" IS NOT NULL;

ALTER TABLE "food_nutrition_corrections" ADD CONSTRAINT "food_nutrition_corrections_foodItemId_fkey"
    FOREIGN KEY ("foodItemId") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_nutrition_corrections" ADD CONSTRAINT "food_nutrition_corrections_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_nutrition_corrections" ADD CONSTRAINT "food_nutrition_corrections_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
