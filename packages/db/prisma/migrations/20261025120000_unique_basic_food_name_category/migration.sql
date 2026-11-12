-- Run prisma/checks/basic-food-duplicates.sql before deploying this migration.
-- Existing duplicates must be resolved explicitly; this migration never deletes data.
-- Keep these expressions identical to the FoodsService duplicate lookup.
CREATE UNIQUE INDEX "food_items_basic_name_category_key"
ON "food_items" (
    lower(btrim("name")),
    lower(btrim(COALESCE("category", '')))
)
WHERE "type" = 'BASIC';
