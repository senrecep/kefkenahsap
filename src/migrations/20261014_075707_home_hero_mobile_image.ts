import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_blocks_hero" ADD COLUMN "mobile_image_id" integer;
  ALTER TABLE "_homepage_v_blocks_hero" ADD COLUMN "mobile_image_id" integer;
  ALTER TABLE "homepage_blocks_hero" ADD CONSTRAINT "homepage_blocks_hero_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_hero" ADD CONSTRAINT "_homepage_v_blocks_hero_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "homepage_blocks_hero_mobile_image_idx" ON "homepage_blocks_hero" USING btree ("mobile_image_id");
  CREATE INDEX "_homepage_v_blocks_hero_mobile_image_idx" ON "_homepage_v_blocks_hero" USING btree ("mobile_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "homepage_blocks_hero" DROP CONSTRAINT "homepage_blocks_hero_mobile_image_id_media_id_fk";
  
  ALTER TABLE "_homepage_v_blocks_hero" DROP CONSTRAINT "_homepage_v_blocks_hero_mobile_image_id_media_id_fk";
  
  DROP INDEX "homepage_blocks_hero_mobile_image_idx";
  DROP INDEX "_homepage_v_blocks_hero_mobile_image_idx";
  ALTER TABLE "homepage_blocks_hero" DROP COLUMN "mobile_image_id";
  ALTER TABLE "_homepage_v_blocks_hero" DROP COLUMN "mobile_image_id";`)
}
