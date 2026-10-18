import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "guides" ADD COLUMN "cover_id" integer;
  ALTER TABLE "_guides_v" ADD COLUMN "version_cover_id" integer;
  ALTER TABLE "guides" ADD CONSTRAINT "guides_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_guides_v" ADD CONSTRAINT "_guides_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "guides_cover_idx" ON "guides" USING btree ("cover_id");
  CREATE INDEX "_guides_v_version_version_cover_idx" ON "_guides_v" USING btree ("version_cover_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "guides" DROP CONSTRAINT "guides_cover_id_media_id_fk";
  
  ALTER TABLE "_guides_v" DROP CONSTRAINT "_guides_v_version_cover_id_media_id_fk";
  
  DROP INDEX "guides_cover_idx";
  DROP INDEX "_guides_v_version_version_cover_idx";
  ALTER TABLE "guides" DROP COLUMN "cover_id";
  ALTER TABLE "_guides_v" DROP COLUMN "version_cover_id";`)
}
