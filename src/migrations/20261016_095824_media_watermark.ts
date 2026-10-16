import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_watermark" AS ENUM('applied', 'already', 'none');
  ALTER TABLE "media" ADD COLUMN "watermark" "enum_media_watermark";
  -- Seeded images came from the pipeline already marked; earlier admin uploads were stored unmarked (#169, decision #8).
  UPDATE "media" SET "watermark" = CASE WHEN "seed_key" IS NOT NULL THEN 'already'::"enum_media_watermark" ELSE 'none'::"enum_media_watermark" END;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "watermark";
  DROP TYPE "public"."enum_media_watermark";`)
}
