import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories_locales" ADD COLUMN "body" jsonb;
  ALTER TABLE "_categories_v_locales" ADD COLUMN "version_body" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories_locales" DROP COLUMN "body";
  ALTER TABLE "_categories_v_locales" DROP COLUMN "version_body";`)
}
