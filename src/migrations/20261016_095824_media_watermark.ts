import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_watermark" AS ENUM('applied', 'already', 'none');
  ALTER TABLE "media" ADD COLUMN "watermark" "enum_media_watermark";
  -- Every image stored so far came from the pipeline already marked (#169, decision #8).
  UPDATE "media" SET "watermark" = 'already';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "watermark";
  DROP TYPE "public"."enum_media_watermark";`)
}
