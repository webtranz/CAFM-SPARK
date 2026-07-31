ALTER TABLE "ServiceCatalog" ADD COLUMN "serviceCode" TEXT;

UPDATE "ServiceCatalog"
SET "serviceCode" = CASE
  WHEN "category" IS NOT NULL
    AND "category" <> ''
    AND "code" LIKE "category" || '-%'
    THEN substring("code" from char_length("category") + 2)
  ELSE "code"
END
WHERE "serviceCode" IS NULL;