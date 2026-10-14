import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_hours_days" AS ENUM('Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su');
  CREATE TYPE "public"."enum_site_settings_area_served_kind" AS ENUM('district', 'city', 'country');
  CREATE TYPE "public"."enum_homepage_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__homepage_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__homepage_v_published_locale" AS ENUM('tr', 'en');
  CREATE TABLE "site_settings_phones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"whatsapp" boolean
  );
  
  CREATE TABLE "site_settings_phones_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_hours_days" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_site_settings_hours_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "site_settings_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"opens" varchar NOT NULL,
  	"closes" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_area_served" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_site_settings_area_served_kind" DEFAULT 'district'
  );
  
  CREATE TABLE "site_settings_area_served_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar DEFAULT 'Kefken Ahşap Dekorasyon' NOT NULL,
  	"founding_year" numeric,
  	"founder_name" varchar,
  	"founder_phone" varchar,
  	"founder_craft_start_year" numeric,
  	"team_size" numeric,
  	"project_count" numeric,
  	"email" varchar,
  	"address_street" varchar,
  	"address_district" varchar,
  	"address_city" varchar,
  	"address_postal_code" varchar,
  	"address_country" varchar DEFAULT 'TR',
  	"address_lat" numeric,
  	"address_lng" numeric,
  	"address_map_url" varchar,
  	"whatsapp_number" varchar,
  	"social_instagram" varchar,
  	"social_facebook" varchar,
  	"social_google_business" varchar,
  	"default_og_image_id" integer,
  	"ga_id" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_locales" (
  	"founder_bio" varchar,
  	"whatsapp_templates_default" varchar,
  	"whatsapp_templates_category" varchar,
  	"whatsapp_templates_project" varchar,
  	"whatsapp_templates_image" varchar,
  	"whatsapp_templates_contact" varchar,
  	"office_hours_note" varchar,
  	"default_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_featured_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"limit" numeric DEFAULT 24,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_featured_gallery_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_services_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_featured_projects" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_featured_projects_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "homepage_blocks_process" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_process_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_references" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_references_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_wood_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_wood_types_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"q" varchar,
  	"a" varchar
  );
  
  CREATE TABLE "homepage_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_faq_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "homepage_blocks_contact_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "homepage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_homepage_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_homepage_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_hero_locales" (
  	"heading" varchar,
  	"subheading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_featured_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"limit" numeric DEFAULT 24,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_featured_gallery_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_services_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_featured_projects" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_featured_projects_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_process" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_process_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_references" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_references_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_wood_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_wood_types_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"q" varchar,
  	"a" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_faq_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_homepage_v_blocks_contact_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__homepage_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__homepage_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "navigation_header" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_header_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_footer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_footer_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "site_settings_phones" ADD CONSTRAINT "site_settings_phones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_phones_locales" ADD CONSTRAINT "site_settings_phones_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_phones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_hours_days" ADD CONSTRAINT "site_settings_hours_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_hours" ADD CONSTRAINT "site_settings_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_area_served" ADD CONSTRAINT "site_settings_area_served_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_area_served_locales" ADD CONSTRAINT "site_settings_area_served_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_area_served"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_hero" ADD CONSTRAINT "homepage_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_blocks_hero" ADD CONSTRAINT "homepage_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_hero_locales" ADD CONSTRAINT "homepage_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_featured_gallery" ADD CONSTRAINT "homepage_blocks_featured_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_featured_gallery_locales" ADD CONSTRAINT "homepage_blocks_featured_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_featured_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_services" ADD CONSTRAINT "homepage_blocks_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_services_locales" ADD CONSTRAINT "homepage_blocks_services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_featured_projects" ADD CONSTRAINT "homepage_blocks_featured_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_featured_projects_locales" ADD CONSTRAINT "homepage_blocks_featured_projects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_featured_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_process_steps" ADD CONSTRAINT "homepage_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_process"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_process" ADD CONSTRAINT "homepage_blocks_process_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_process_locales" ADD CONSTRAINT "homepage_blocks_process_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_process"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_references" ADD CONSTRAINT "homepage_blocks_references_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_references_locales" ADD CONSTRAINT "homepage_blocks_references_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_references"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_wood_types" ADD CONSTRAINT "homepage_blocks_wood_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_wood_types_locales" ADD CONSTRAINT "homepage_blocks_wood_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_wood_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_faq_items" ADD CONSTRAINT "homepage_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_faq" ADD CONSTRAINT "homepage_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_faq_locales" ADD CONSTRAINT "homepage_blocks_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_contact" ADD CONSTRAINT "homepage_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_blocks_contact_locales" ADD CONSTRAINT "homepage_blocks_contact_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_hero" ADD CONSTRAINT "_homepage_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_hero" ADD CONSTRAINT "_homepage_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_hero_locales" ADD CONSTRAINT "_homepage_v_blocks_hero_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_featured_gallery" ADD CONSTRAINT "_homepage_v_blocks_featured_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_featured_gallery_locales" ADD CONSTRAINT "_homepage_v_blocks_featured_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_featured_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_services" ADD CONSTRAINT "_homepage_v_blocks_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_services_locales" ADD CONSTRAINT "_homepage_v_blocks_services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_featured_projects" ADD CONSTRAINT "_homepage_v_blocks_featured_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_featured_projects_locales" ADD CONSTRAINT "_homepage_v_blocks_featured_projects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_featured_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_process_steps" ADD CONSTRAINT "_homepage_v_blocks_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_process"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_process" ADD CONSTRAINT "_homepage_v_blocks_process_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_process_locales" ADD CONSTRAINT "_homepage_v_blocks_process_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_process"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_references" ADD CONSTRAINT "_homepage_v_blocks_references_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_references_locales" ADD CONSTRAINT "_homepage_v_blocks_references_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_references"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_wood_types" ADD CONSTRAINT "_homepage_v_blocks_wood_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_wood_types_locales" ADD CONSTRAINT "_homepage_v_blocks_wood_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_wood_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_faq_items" ADD CONSTRAINT "_homepage_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_faq" ADD CONSTRAINT "_homepage_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_faq_locales" ADD CONSTRAINT "_homepage_v_blocks_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_contact" ADD CONSTRAINT "_homepage_v_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_v_blocks_contact_locales" ADD CONSTRAINT "_homepage_v_blocks_contact_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_v_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_header" ADD CONSTRAINT "navigation_header_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_header_locales" ADD CONSTRAINT "navigation_header_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_footer" ADD CONSTRAINT "navigation_footer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_footer_locales" ADD CONSTRAINT "navigation_footer_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_footer"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_phones_order_idx" ON "site_settings_phones" USING btree ("_order");
  CREATE INDEX "site_settings_phones_parent_id_idx" ON "site_settings_phones" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_phones_locales_locale_parent_id_unique" ON "site_settings_phones_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_hours_days_order_idx" ON "site_settings_hours_days" USING btree ("order");
  CREATE INDEX "site_settings_hours_days_parent_idx" ON "site_settings_hours_days" USING btree ("parent_id");
  CREATE INDEX "site_settings_hours_order_idx" ON "site_settings_hours" USING btree ("_order");
  CREATE INDEX "site_settings_hours_parent_id_idx" ON "site_settings_hours" USING btree ("_parent_id");
  CREATE INDEX "site_settings_area_served_order_idx" ON "site_settings_area_served" USING btree ("_order");
  CREATE INDEX "site_settings_area_served_parent_id_idx" ON "site_settings_area_served" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_area_served_locales_locale_parent_id_unique" ON "site_settings_area_served_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_default_og_image_idx" ON "site_settings" USING btree ("default_og_image_id");
  CREATE UNIQUE INDEX "site_settings_locales_locale_parent_id_unique" ON "site_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_hero_order_idx" ON "homepage_blocks_hero" USING btree ("_order");
  CREATE INDEX "homepage_blocks_hero_parent_id_idx" ON "homepage_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_hero_path_idx" ON "homepage_blocks_hero" USING btree ("_path");
  CREATE INDEX "homepage_blocks_hero_image_idx" ON "homepage_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "homepage_blocks_hero_locales_locale_parent_id_unique" ON "homepage_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_featured_gallery_order_idx" ON "homepage_blocks_featured_gallery" USING btree ("_order");
  CREATE INDEX "homepage_blocks_featured_gallery_parent_id_idx" ON "homepage_blocks_featured_gallery" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_featured_gallery_path_idx" ON "homepage_blocks_featured_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_featured_gallery_locales_locale_parent_id_un" ON "homepage_blocks_featured_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_services_order_idx" ON "homepage_blocks_services" USING btree ("_order");
  CREATE INDEX "homepage_blocks_services_parent_id_idx" ON "homepage_blocks_services" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_services_path_idx" ON "homepage_blocks_services" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_services_locales_locale_parent_id_unique" ON "homepage_blocks_services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_featured_projects_order_idx" ON "homepage_blocks_featured_projects" USING btree ("_order");
  CREATE INDEX "homepage_blocks_featured_projects_parent_id_idx" ON "homepage_blocks_featured_projects" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_featured_projects_path_idx" ON "homepage_blocks_featured_projects" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_featured_projects_locales_locale_parent_id_u" ON "homepage_blocks_featured_projects_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_process_steps_order_idx" ON "homepage_blocks_process_steps" USING btree ("_order");
  CREATE INDEX "homepage_blocks_process_steps_parent_id_idx" ON "homepage_blocks_process_steps" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_process_steps_locale_idx" ON "homepage_blocks_process_steps" USING btree ("_locale");
  CREATE INDEX "homepage_blocks_process_order_idx" ON "homepage_blocks_process" USING btree ("_order");
  CREATE INDEX "homepage_blocks_process_parent_id_idx" ON "homepage_blocks_process" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_process_path_idx" ON "homepage_blocks_process" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_process_locales_locale_parent_id_unique" ON "homepage_blocks_process_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_references_order_idx" ON "homepage_blocks_references" USING btree ("_order");
  CREATE INDEX "homepage_blocks_references_parent_id_idx" ON "homepage_blocks_references" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_references_path_idx" ON "homepage_blocks_references" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_references_locales_locale_parent_id_unique" ON "homepage_blocks_references_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_wood_types_order_idx" ON "homepage_blocks_wood_types" USING btree ("_order");
  CREATE INDEX "homepage_blocks_wood_types_parent_id_idx" ON "homepage_blocks_wood_types" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_wood_types_path_idx" ON "homepage_blocks_wood_types" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_wood_types_locales_locale_parent_id_unique" ON "homepage_blocks_wood_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_faq_items_order_idx" ON "homepage_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "homepage_blocks_faq_items_parent_id_idx" ON "homepage_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_faq_items_locale_idx" ON "homepage_blocks_faq_items" USING btree ("_locale");
  CREATE INDEX "homepage_blocks_faq_order_idx" ON "homepage_blocks_faq" USING btree ("_order");
  CREATE INDEX "homepage_blocks_faq_parent_id_idx" ON "homepage_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_faq_path_idx" ON "homepage_blocks_faq" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_faq_locales_locale_parent_id_unique" ON "homepage_blocks_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_blocks_contact_order_idx" ON "homepage_blocks_contact" USING btree ("_order");
  CREATE INDEX "homepage_blocks_contact_parent_id_idx" ON "homepage_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX "homepage_blocks_contact_path_idx" ON "homepage_blocks_contact" USING btree ("_path");
  CREATE UNIQUE INDEX "homepage_blocks_contact_locales_locale_parent_id_unique" ON "homepage_blocks_contact_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage__status_idx" ON "homepage" USING btree ("_status");
  CREATE INDEX "_homepage_v_blocks_hero_order_idx" ON "_homepage_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_hero_parent_id_idx" ON "_homepage_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_hero_path_idx" ON "_homepage_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_homepage_v_blocks_hero_image_idx" ON "_homepage_v_blocks_hero" USING btree ("image_id");
  CREATE UNIQUE INDEX "_homepage_v_blocks_hero_locales_locale_parent_id_unique" ON "_homepage_v_blocks_hero_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_featured_gallery_order_idx" ON "_homepage_v_blocks_featured_gallery" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_featured_gallery_parent_id_idx" ON "_homepage_v_blocks_featured_gallery" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_featured_gallery_path_idx" ON "_homepage_v_blocks_featured_gallery" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_featured_gallery_locales_locale_parent_id" ON "_homepage_v_blocks_featured_gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_services_order_idx" ON "_homepage_v_blocks_services" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_services_parent_id_idx" ON "_homepage_v_blocks_services" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_services_path_idx" ON "_homepage_v_blocks_services" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_services_locales_locale_parent_id_unique" ON "_homepage_v_blocks_services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_featured_projects_order_idx" ON "_homepage_v_blocks_featured_projects" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_featured_projects_parent_id_idx" ON "_homepage_v_blocks_featured_projects" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_featured_projects_path_idx" ON "_homepage_v_blocks_featured_projects" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_featured_projects_locales_locale_parent_i" ON "_homepage_v_blocks_featured_projects_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_process_steps_order_idx" ON "_homepage_v_blocks_process_steps" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_process_steps_parent_id_idx" ON "_homepage_v_blocks_process_steps" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_process_steps_locale_idx" ON "_homepage_v_blocks_process_steps" USING btree ("_locale");
  CREATE INDEX "_homepage_v_blocks_process_order_idx" ON "_homepage_v_blocks_process" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_process_parent_id_idx" ON "_homepage_v_blocks_process" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_process_path_idx" ON "_homepage_v_blocks_process" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_process_locales_locale_parent_id_unique" ON "_homepage_v_blocks_process_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_references_order_idx" ON "_homepage_v_blocks_references" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_references_parent_id_idx" ON "_homepage_v_blocks_references" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_references_path_idx" ON "_homepage_v_blocks_references" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_references_locales_locale_parent_id_uniqu" ON "_homepage_v_blocks_references_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_wood_types_order_idx" ON "_homepage_v_blocks_wood_types" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_wood_types_parent_id_idx" ON "_homepage_v_blocks_wood_types" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_wood_types_path_idx" ON "_homepage_v_blocks_wood_types" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_wood_types_locales_locale_parent_id_uniqu" ON "_homepage_v_blocks_wood_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_faq_items_order_idx" ON "_homepage_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_faq_items_parent_id_idx" ON "_homepage_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_faq_items_locale_idx" ON "_homepage_v_blocks_faq_items" USING btree ("_locale");
  CREATE INDEX "_homepage_v_blocks_faq_order_idx" ON "_homepage_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_faq_parent_id_idx" ON "_homepage_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_faq_path_idx" ON "_homepage_v_blocks_faq" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_faq_locales_locale_parent_id_unique" ON "_homepage_v_blocks_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_blocks_contact_order_idx" ON "_homepage_v_blocks_contact" USING btree ("_order");
  CREATE INDEX "_homepage_v_blocks_contact_parent_id_idx" ON "_homepage_v_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX "_homepage_v_blocks_contact_path_idx" ON "_homepage_v_blocks_contact" USING btree ("_path");
  CREATE UNIQUE INDEX "_homepage_v_blocks_contact_locales_locale_parent_id_unique" ON "_homepage_v_blocks_contact_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_v_version_version__status_idx" ON "_homepage_v" USING btree ("version__status");
  CREATE INDEX "_homepage_v_created_at_idx" ON "_homepage_v" USING btree ("created_at");
  CREATE INDEX "_homepage_v_updated_at_idx" ON "_homepage_v" USING btree ("updated_at");
  CREATE INDEX "_homepage_v_snapshot_idx" ON "_homepage_v" USING btree ("snapshot");
  CREATE INDEX "_homepage_v_published_locale_idx" ON "_homepage_v" USING btree ("published_locale");
  CREATE INDEX "_homepage_v_latest_idx" ON "_homepage_v" USING btree ("latest");
  CREATE INDEX "navigation_header_order_idx" ON "navigation_header" USING btree ("_order");
  CREATE INDEX "navigation_header_parent_id_idx" ON "navigation_header" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "navigation_header_locales_locale_parent_id_unique" ON "navigation_header_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "navigation_footer_order_idx" ON "navigation_footer" USING btree ("_order");
  CREATE INDEX "navigation_footer_parent_id_idx" ON "navigation_footer" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "navigation_footer_locales_locale_parent_id_unique" ON "navigation_footer_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_phones" CASCADE;
  DROP TABLE "site_settings_phones_locales" CASCADE;
  DROP TABLE "site_settings_hours_days" CASCADE;
  DROP TABLE "site_settings_hours" CASCADE;
  DROP TABLE "site_settings_area_served" CASCADE;
  DROP TABLE "site_settings_area_served_locales" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_locales" CASCADE;
  DROP TABLE "homepage_blocks_hero" CASCADE;
  DROP TABLE "homepage_blocks_hero_locales" CASCADE;
  DROP TABLE "homepage_blocks_featured_gallery" CASCADE;
  DROP TABLE "homepage_blocks_featured_gallery_locales" CASCADE;
  DROP TABLE "homepage_blocks_services" CASCADE;
  DROP TABLE "homepage_blocks_services_locales" CASCADE;
  DROP TABLE "homepage_blocks_featured_projects" CASCADE;
  DROP TABLE "homepage_blocks_featured_projects_locales" CASCADE;
  DROP TABLE "homepage_blocks_process_steps" CASCADE;
  DROP TABLE "homepage_blocks_process" CASCADE;
  DROP TABLE "homepage_blocks_process_locales" CASCADE;
  DROP TABLE "homepage_blocks_references" CASCADE;
  DROP TABLE "homepage_blocks_references_locales" CASCADE;
  DROP TABLE "homepage_blocks_wood_types" CASCADE;
  DROP TABLE "homepage_blocks_wood_types_locales" CASCADE;
  DROP TABLE "homepage_blocks_faq_items" CASCADE;
  DROP TABLE "homepage_blocks_faq" CASCADE;
  DROP TABLE "homepage_blocks_faq_locales" CASCADE;
  DROP TABLE "homepage_blocks_contact" CASCADE;
  DROP TABLE "homepage_blocks_contact_locales" CASCADE;
  DROP TABLE "homepage" CASCADE;
  DROP TABLE "_homepage_v_blocks_hero" CASCADE;
  DROP TABLE "_homepage_v_blocks_hero_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_featured_gallery" CASCADE;
  DROP TABLE "_homepage_v_blocks_featured_gallery_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_services" CASCADE;
  DROP TABLE "_homepage_v_blocks_services_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_featured_projects" CASCADE;
  DROP TABLE "_homepage_v_blocks_featured_projects_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_process_steps" CASCADE;
  DROP TABLE "_homepage_v_blocks_process" CASCADE;
  DROP TABLE "_homepage_v_blocks_process_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_references" CASCADE;
  DROP TABLE "_homepage_v_blocks_references_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_wood_types" CASCADE;
  DROP TABLE "_homepage_v_blocks_wood_types_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_faq_items" CASCADE;
  DROP TABLE "_homepage_v_blocks_faq" CASCADE;
  DROP TABLE "_homepage_v_blocks_faq_locales" CASCADE;
  DROP TABLE "_homepage_v_blocks_contact" CASCADE;
  DROP TABLE "_homepage_v_blocks_contact_locales" CASCADE;
  DROP TABLE "_homepage_v" CASCADE;
  DROP TABLE "navigation_header" CASCADE;
  DROP TABLE "navigation_header_locales" CASCADE;
  DROP TABLE "navigation_footer" CASCADE;
  DROP TABLE "navigation_footer_locales" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TYPE "public"."enum_site_settings_hours_days";
  DROP TYPE "public"."enum_site_settings_area_served_kind";
  DROP TYPE "public"."enum_homepage_status";
  DROP TYPE "public"."enum__homepage_v_version_status";
  DROP TYPE "public"."enum__homepage_v_published_locale";`)
}
