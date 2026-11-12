-- Read-only preflight for 20261025120000_unique_basic_food_name_category.
-- No rows means that existing data can satisfy the new unique index.
SELECT
    lower(btrim("name")) AS normalized_name,
    lower(btrim(COALESCE("category", ''))) AS normalized_category,
    count(*) AS duplicate_count,
    jsonb_agg(
        jsonb_build_object('id', "id", 'name', "name", 'category', "category")
        ORDER BY "id"
    ) AS records
FROM "food_items"
WHERE "type" = 'BASIC'
GROUP BY lower(btrim("name")), lower(btrim(COALESCE("category", '')))
HAVING count(*) > 1
ORDER BY normalized_name, normalized_category;
