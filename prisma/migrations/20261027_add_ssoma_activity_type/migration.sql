CREATE TYPE "SsomaActivityType" AS ENUM (
  'INDUCTION',
  'TALK',
  'TRAINING',
  'PRACTICE',
  'DRILL',
  'OTHER'
);

ALTER TABLE "SsomaTalk"
  ADD COLUMN "activityType" "SsomaActivityType" NOT NULL DEFAULT 'TALK',
  ADD COLUMN "otherActivityText" VARCHAR(12);

ALTER TABLE "SsomaTalk"
  ADD CONSTRAINT "SsomaTalk_activityType_otherActivityText_check"
  CHECK (
    ("activityType" = 'OTHER' AND "otherActivityText" IS NOT NULL AND btrim("otherActivityText") <> '')
    OR ("activityType" <> 'OTHER' AND "otherActivityText" IS NULL)
  );
