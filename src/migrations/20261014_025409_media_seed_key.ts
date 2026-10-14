import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "seed_key" varchar;
  CREATE UNIQUE INDEX "media_seed_key_idx" ON "media" USING btree ("seed_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_seed_key_idx";
  ALTER TABLE "media" DROP COLUMN "seed_key";`)
}
