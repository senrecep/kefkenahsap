import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "address_map_embed_url" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "address_apple_maps_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "address_map_embed_url";
  ALTER TABLE "site_settings" DROP COLUMN "address_apple_maps_url";`)
}
