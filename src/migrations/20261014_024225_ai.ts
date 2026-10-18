import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'tagImage';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'tagImage';
  CREATE TABLE "ai_usage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"task" varchar NOT NULL,
  	"model" varchar,
  	"ok" boolean,
  	"cost_usd" numeric,
  	"input_tokens" numeric,
  	"output_tokens" numeric,
  	"doc_ref" varchar,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_settings_glossary" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tr" varchar NOT NULL,
  	"en" varchar NOT NULL
  );
  
  CREATE TABLE "ai_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"monthly_budget_usd" numeric DEFAULT 10,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ai_settings_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_usage_id" integer;
  ALTER TABLE "ai_settings_glossary" ADD CONSTRAINT "ai_settings_glossary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_texts" ADD CONSTRAINT "ai_settings_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ai_usage_task_idx" ON "ai_usage" USING btree ("task");
  CREATE INDEX "ai_usage_updated_at_idx" ON "ai_usage" USING btree ("updated_at");
  CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");
  CREATE INDEX "ai_settings_glossary_order_idx" ON "ai_settings_glossary" USING btree ("_order");
  CREATE INDEX "ai_settings_glossary_parent_id_idx" ON "ai_settings_glossary" USING btree ("_parent_id");
  CREATE INDEX "ai_settings_texts_order_parent" ON "ai_settings_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_usage_fk" FOREIGN KEY ("ai_usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ai_usage_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_usage_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ai_usage" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_settings_glossary" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_settings_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_usage" CASCADE;
  DROP TABLE "ai_settings_glossary" CASCADE;
  DROP TABLE "ai_settings" CASCADE;
  DROP TABLE "ai_settings_texts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_usage_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'purgeExpiredLeads');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'purgeExpiredLeads');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_ai_usage_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_usage_id";`)
}
