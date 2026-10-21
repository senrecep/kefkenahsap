import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_outgoing_emails_status" AS ENUM('draft', 'sent', 'failed');
  CREATE TABLE "outgoing_emails" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"to" varchar NOT NULL,
  	"to_name" varchar,
  	"subject" varchar NOT NULL,
  	"body" jsonb NOT NULL,
  	"lead_id" integer,
  	"status" "enum_outgoing_emails_status" DEFAULT 'draft',
  	"sent_at" timestamp(3) with time zone,
  	"error" varchar,
  	"retention_until" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "outgoing_emails_id" integer;
  ALTER TABLE "outgoing_emails" ADD CONSTRAINT "outgoing_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "outgoing_emails_lead_idx" ON "outgoing_emails" USING btree ("lead_id");
  CREATE INDEX "outgoing_emails_retention_until_idx" ON "outgoing_emails" USING btree ("retention_until");
  CREATE INDEX "outgoing_emails_updated_at_idx" ON "outgoing_emails" USING btree ("updated_at");
  CREATE INDEX "outgoing_emails_created_at_idx" ON "outgoing_emails" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outgoing_emails_fk" FOREIGN KEY ("outgoing_emails_id") REFERENCES "public"."outgoing_emails"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_outgoing_emails_id_idx" ON "payload_locked_documents_rels" USING btree ("outgoing_emails_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "outgoing_emails" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "outgoing_emails" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_outgoing_emails_fk";
  
  DROP INDEX "payload_locked_documents_rels_outgoing_emails_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "outgoing_emails_id";
  DROP TYPE "public"."enum_outgoing_emails_status";`)
}
