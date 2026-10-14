import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_regions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__regions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__regions_v_published_locale" AS ENUM('tr', 'en');
  CREATE TABLE "regions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_regions_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "regions_locales" (
  	"name" varchar,
  	"slug" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_regions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__regions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__regions_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_regions_v_locales" (
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "projects" ADD COLUMN "region_id" integer;
  ALTER TABLE "_projects_v" ADD COLUMN "version_region_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "regions_id" integer;
  ALTER TABLE "regions_locales" ADD CONSTRAINT "regions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_regions_v" ADD CONSTRAINT "_regions_v_parent_id_regions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_regions_v_locales" ADD CONSTRAINT "_regions_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_regions_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "regions_updated_at_idx" ON "regions" USING btree ("updated_at");
  CREATE INDEX "regions_created_at_idx" ON "regions" USING btree ("created_at");
  CREATE INDEX "regions__status_idx" ON "regions" USING btree ("_status");
  CREATE UNIQUE INDEX "regions_slug_idx" ON "regions_locales" USING btree ("slug","_locale");
  CREATE UNIQUE INDEX "regions_locales_locale_parent_id_unique" ON "regions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_regions_v_parent_idx" ON "_regions_v" USING btree ("parent_id");
  CREATE INDEX "_regions_v_version_version_updated_at_idx" ON "_regions_v" USING btree ("version_updated_at");
  CREATE INDEX "_regions_v_version_version_created_at_idx" ON "_regions_v" USING btree ("version_created_at");
  CREATE INDEX "_regions_v_version_version__status_idx" ON "_regions_v" USING btree ("version__status");
  CREATE INDEX "_regions_v_created_at_idx" ON "_regions_v" USING btree ("created_at");
  CREATE INDEX "_regions_v_updated_at_idx" ON "_regions_v" USING btree ("updated_at");
  CREATE INDEX "_regions_v_snapshot_idx" ON "_regions_v" USING btree ("snapshot");
  CREATE INDEX "_regions_v_published_locale_idx" ON "_regions_v" USING btree ("published_locale");
  CREATE INDEX "_regions_v_latest_idx" ON "_regions_v" USING btree ("latest");
  CREATE INDEX "_regions_v_version_version_slug_idx" ON "_regions_v_locales" USING btree ("version_slug","_locale");
  CREATE UNIQUE INDEX "_regions_v_locales_locale_parent_id_unique" ON "_regions_v_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "projects" ADD CONSTRAINT "projects_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_version_region_id_regions_id_fk" FOREIGN KEY ("version_region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_region_idx" ON "projects" USING btree ("region_id");
  CREATE INDEX "_projects_v_version_version_region_idx" ON "_projects_v" USING btree ("version_region_id");
  CREATE INDEX "payload_locked_documents_rels_regions_id_idx" ON "payload_locked_documents_rels" USING btree ("regions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "regions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "regions_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_regions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_regions_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "regions" CASCADE;
  DROP TABLE "regions_locales" CASCADE;
  DROP TABLE "_regions_v" CASCADE;
  DROP TABLE "_regions_v_locales" CASCADE;
  ALTER TABLE "projects" DROP CONSTRAINT "projects_region_id_regions_id_fk";
  
  ALTER TABLE "_projects_v" DROP CONSTRAINT "_projects_v_version_region_id_regions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_regions_fk";
  
  DROP INDEX "projects_region_idx";
  DROP INDEX "_projects_v_version_version_region_idx";
  DROP INDEX "payload_locked_documents_rels_regions_id_idx";
  ALTER TABLE "projects" DROP COLUMN "region_id";
  ALTER TABLE "_projects_v" DROP COLUMN "version_region_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "regions_id";
  DROP TYPE "public"."enum_regions_status";
  DROP TYPE "public"."enum__regions_v_version_status";
  DROP TYPE "public"."enum__regions_v_published_locale";`)
}
