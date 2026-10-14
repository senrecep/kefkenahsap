import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_media_status" AS ENUM('pending', 'approved', 'hidden');
  CREATE TYPE "public"."enum_categories_price_guide_unit" AS ENUM('m2', 'm', 'piece');
  CREATE TYPE "public"."enum_categories_price_guide_currency" AS ENUM('TRY', 'EUR', 'USD');
  CREATE TYPE "public"."enum__categories_v_version_price_guide_unit" AS ENUM('m2', 'm', 'piece');
  CREATE TYPE "public"."enum__categories_v_version_price_guide_currency" AS ENUM('TRY', 'EUR', 'USD');
  CREATE TYPE "public"."enum_tags_axis" AS ENUM('wood', 'setting', 'finish', 'stage');
  CREATE TABLE "media_legacy_urls" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar
  );
  
  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "categories_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"q" varchar,
  	"a" varchar
  );
  
  CREATE TABLE "_categories_v_version_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"q" varchar,
  	"a" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"axis" "enum_tags_axis" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_locales" (
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'editor';
  -- Accounts that existed before roles (the owner's first account) become admins.
  UPDATE "users" SET "role" = 'admin' WHERE "role" IS NULL OR "role" = 'editor';
  ALTER TABLE "media" ADD COLUMN "status" "enum_media_status" DEFAULT 'pending';
  ALTER TABLE "media" ADD COLUMN "seo_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "featured" boolean;
  ALTER TABLE "media" ADD COLUMN "captured_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN "ai_suggestion" jsonb;
  ALTER TABLE "media" ADD COLUMN "lqip" varchar;
  ALTER TABLE "media" ADD COLUMN "dominant_color" varchar;
  ALTER TABLE "media" ADD COLUMN "legacy_attachment_url" varchar;
  ALTER TABLE "media_locales" ADD COLUMN "title" varchar;
  ALTER TABLE "media_locales" ADD COLUMN "caption" varchar;
  ALTER TABLE "categories" ADD COLUMN "price_guide_min" numeric;
  ALTER TABLE "categories" ADD COLUMN "price_guide_max" numeric;
  ALTER TABLE "categories" ADD COLUMN "price_guide_unit" "enum_categories_price_guide_unit";
  ALTER TABLE "categories" ADD COLUMN "price_guide_currency" "enum_categories_price_guide_currency" DEFAULT 'TRY';
  ALTER TABLE "categories" ADD COLUMN "price_guide_updated_at" timestamp(3) with time zone;
  ALTER TABLE "categories" ADD COLUMN "cover_id" integer;
  ALTER TABLE "categories" ADD COLUMN "seo_og_image_id" integer;
  ALTER TABLE "categories_locales" ADD COLUMN "short_desc" varchar;
  ALTER TABLE "categories_locales" ADD COLUMN "price_guide_note" varchar;
  ALTER TABLE "categories_locales" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "categories_locales" ADD COLUMN "seo_description" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_price_guide_min" numeric;
  ALTER TABLE "_categories_v" ADD COLUMN "version_price_guide_max" numeric;
  ALTER TABLE "_categories_v" ADD COLUMN "version_price_guide_unit" "enum__categories_v_version_price_guide_unit";
  ALTER TABLE "_categories_v" ADD COLUMN "version_price_guide_currency" "enum__categories_v_version_price_guide_currency" DEFAULT 'TRY';
  ALTER TABLE "_categories_v" ADD COLUMN "version_price_guide_updated_at" timestamp(3) with time zone;
  ALTER TABLE "_categories_v" ADD COLUMN "version_cover_id" integer;
  ALTER TABLE "_categories_v" ADD COLUMN "version_seo_og_image_id" integer;
  ALTER TABLE "_categories_v_locales" ADD COLUMN "version_short_desc" varchar;
  ALTER TABLE "_categories_v_locales" ADD COLUMN "version_price_guide_note" varchar;
  ALTER TABLE "_categories_v_locales" ADD COLUMN "version_seo_title" varchar;
  ALTER TABLE "_categories_v_locales" ADD COLUMN "version_seo_description" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "media_legacy_urls" ADD CONSTRAINT "media_legacy_urls_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_faq" ADD CONSTRAINT "categories_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_faq" ADD CONSTRAINT "_categories_v_version_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_locales" ADD CONSTRAINT "tags_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_legacy_urls_order_idx" ON "media_legacy_urls" USING btree ("_order");
  CREATE INDEX "media_legacy_urls_parent_id_idx" ON "media_legacy_urls" USING btree ("_parent_id");
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_tags_id_idx" ON "media_rels" USING btree ("tags_id");
  CREATE INDEX "categories_faq_order_idx" ON "categories_faq" USING btree ("_order");
  CREATE INDEX "categories_faq_parent_id_idx" ON "categories_faq" USING btree ("_parent_id");
  CREATE INDEX "categories_faq_locale_idx" ON "categories_faq" USING btree ("_locale");
  CREATE INDEX "_categories_v_version_faq_order_idx" ON "_categories_v_version_faq" USING btree ("_order");
  CREATE INDEX "_categories_v_version_faq_parent_id_idx" ON "_categories_v_version_faq" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_version_faq_locale_idx" ON "_categories_v_version_faq" USING btree ("_locale");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags_locales" USING btree ("slug","_locale");
  CREATE UNIQUE INDEX "tags_locales_locale_parent_id_unique" ON "tags_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "categories" ADD CONSTRAINT "categories_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_status_idx" ON "media" USING btree ("status");
  CREATE INDEX "media_seo_filename_idx" ON "media" USING btree ("seo_filename");
  CREATE INDEX "categories_cover_idx" ON "categories" USING btree ("cover_id");
  CREATE INDEX "categories_seo_seo_og_image_idx" ON "categories" USING btree ("seo_og_image_id");
  CREATE INDEX "_categories_v_version_version_cover_idx" ON "_categories_v" USING btree ("version_cover_id");
  CREATE INDEX "_categories_v_version_seo_version_seo_og_image_idx" ON "_categories_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media_legacy_urls" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media_legacy_urls" CASCADE;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "categories_faq" CASCADE;
  DROP TABLE "_categories_v_version_faq" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_locales" CASCADE;
  ALTER TABLE "categories" DROP CONSTRAINT "categories_cover_id_media_id_fk";
  
  ALTER TABLE "categories" DROP CONSTRAINT "categories_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "_categories_v" DROP CONSTRAINT "_categories_v_version_cover_id_media_id_fk";
  
  ALTER TABLE "_categories_v" DROP CONSTRAINT "_categories_v_version_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tags_fk";
  
  DROP INDEX "media_status_idx";
  DROP INDEX "media_seo_filename_idx";
  DROP INDEX "categories_cover_idx";
  DROP INDEX "categories_seo_seo_og_image_idx";
  DROP INDEX "_categories_v_version_version_cover_idx";
  DROP INDEX "_categories_v_version_seo_version_seo_og_image_idx";
  DROP INDEX "payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "media" DROP COLUMN "status";
  ALTER TABLE "media" DROP COLUMN "seo_filename";
  ALTER TABLE "media" DROP COLUMN "featured";
  ALTER TABLE "media" DROP COLUMN "captured_at";
  ALTER TABLE "media" DROP COLUMN "ai_suggestion";
  ALTER TABLE "media" DROP COLUMN "lqip";
  ALTER TABLE "media" DROP COLUMN "dominant_color";
  ALTER TABLE "media" DROP COLUMN "legacy_attachment_url";
  ALTER TABLE "media_locales" DROP COLUMN "title";
  ALTER TABLE "media_locales" DROP COLUMN "caption";
  ALTER TABLE "categories" DROP COLUMN "price_guide_min";
  ALTER TABLE "categories" DROP COLUMN "price_guide_max";
  ALTER TABLE "categories" DROP COLUMN "price_guide_unit";
  ALTER TABLE "categories" DROP COLUMN "price_guide_currency";
  ALTER TABLE "categories" DROP COLUMN "price_guide_updated_at";
  ALTER TABLE "categories" DROP COLUMN "cover_id";
  ALTER TABLE "categories" DROP COLUMN "seo_og_image_id";
  ALTER TABLE "categories_locales" DROP COLUMN "short_desc";
  ALTER TABLE "categories_locales" DROP COLUMN "price_guide_note";
  ALTER TABLE "categories_locales" DROP COLUMN "seo_title";
  ALTER TABLE "categories_locales" DROP COLUMN "seo_description";
  ALTER TABLE "_categories_v" DROP COLUMN "version_price_guide_min";
  ALTER TABLE "_categories_v" DROP COLUMN "version_price_guide_max";
  ALTER TABLE "_categories_v" DROP COLUMN "version_price_guide_unit";
  ALTER TABLE "_categories_v" DROP COLUMN "version_price_guide_currency";
  ALTER TABLE "_categories_v" DROP COLUMN "version_price_guide_updated_at";
  ALTER TABLE "_categories_v" DROP COLUMN "version_cover_id";
  ALTER TABLE "_categories_v" DROP COLUMN "version_seo_og_image_id";
  ALTER TABLE "_categories_v_locales" DROP COLUMN "version_short_desc";
  ALTER TABLE "_categories_v_locales" DROP COLUMN "version_price_guide_note";
  ALTER TABLE "_categories_v_locales" DROP COLUMN "version_seo_title";
  ALTER TABLE "_categories_v_locales" DROP COLUMN "version_seo_description";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tags_id";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_media_status";
  DROP TYPE "public"."enum_categories_price_guide_unit";
  DROP TYPE "public"."enum_categories_price_guide_currency";
  DROP TYPE "public"."enum__categories_v_version_price_guide_unit";
  DROP TYPE "public"."enum__categories_v_version_price_guide_currency";
  DROP TYPE "public"."enum_tags_axis";`)
}
