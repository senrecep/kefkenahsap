import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_tags_axis" ADD VALUE 'type' BEFORE 'wood';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Fails while any tag is on the 'type' axis: move or delete those tags first (a down never deletes them silently).
  await db.execute(sql`
   ALTER TABLE "tags" ALTER COLUMN "axis" SET DATA TYPE text;
  DROP TYPE "public"."enum_tags_axis";
  CREATE TYPE "public"."enum_tags_axis" AS ENUM('wood', 'setting', 'finish', 'stage');
  ALTER TABLE "tags" ALTER COLUMN "axis" SET DATA TYPE "public"."enum_tags_axis" USING "axis"::"public"."enum_tags_axis";`)
}
