import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "sizes_portrait_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_portrait_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_portrait_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_portrait_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_portrait_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_portrait_filename" varchar;
  CREATE INDEX "media_sizes_portrait_sizes_portrait_filename_idx" ON "media" USING btree ("sizes_portrait_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_sizes_portrait_sizes_portrait_filename_idx";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_url";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_width";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_height";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_portrait_filename";`)
}
