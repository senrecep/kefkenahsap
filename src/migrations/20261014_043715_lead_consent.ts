import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leads" ADD COLUMN "consent_at" timestamp(3) with time zone;
  ALTER TABLE "leads" ADD COLUMN "consent_text_version" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leads" DROP COLUMN "consent_at";
  ALTER TABLE "leads" DROP COLUMN "consent_text_version";`)
}
