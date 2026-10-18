import * as migration_20261014_010551_initial from './20261014_010551_initial';
import * as migration_20261014_011722_categories_body from './20261014_011722_categories_body';
import * as migration_20261014_012616_review_fixes from './20261014_012616_review_fixes';
import * as migration_20261014_015435_core_collections from './20261014_015435_core_collections';
import * as migration_20261014_021522_globals from './20261014_021522_globals';
import * as migration_20261014_022343_projects_references_pages from './20261014_022343_projects_references_pages';
import * as migration_20261014_023200_leads from './20261014_023200_leads';
import * as migration_20261014_024225_ai from './20261014_024225_ai';
import * as migration_20261014_025409_media_seed_key from './20261014_025409_media_seed_key';
import * as migration_20261014_033742_search from './20261014_033742_search';
import * as migration_20261014_043715_lead_consent from './20261014_043715_lead_consent';
import * as migration_20261014_065329_media_prefix from './20261014_065329_media_prefix';
import * as migration_20261014_070517_guides from './20261014_070517_guides';
import * as migration_20261014_075707_home_hero_mobile_image from './20261014_075707_home_hero_mobile_image';
import * as migration_20261014_090734_regions from './20261014_090734_regions';
import * as migration_20261014_100749_media_w480 from './20261014_100749_media_w480';
import * as migration_20261014_130823_media_w800 from './20261014_130823_media_w800';
import * as migration_20261014_144607_ru_de_locales from './20261014_144607_ru_de_locales';
import * as migration_20261014_145205_ar_locale from './20261014_145205_ar_locale';
import * as migration_20261014_161144_media_portrait from './20261014_161144_media_portrait';
import * as migration_20261014_220922_contact_map from './20261014_220922_contact_map';
import * as migration_20261015_085755_search_guides from './20261015_085755_search_guides';
import * as migration_20261015_085928_guide_cover from './20261015_085928_guide_cover';
import * as migration_20261016_095824_media_watermark from './20261016_095824_media_watermark';
import * as migration_20261016_115000_tag_type_axis from './20261016_115000_tag_type_axis';
import * as migration_20261016_235956_hero_slides from './20261016_235956_hero_slides';
import * as migration_20261017_224837_translate_media from './20261017_224837_translate_media';
import * as migration_20261018_093407_seo_rename from './20261018_093407_seo_rename';
import * as migration_20261018_095155_seo_retired_stems from './20261018_095155_seo_retired_stems';

export const migrations = [
  {
    up: migration_20261014_010551_initial.up,
    down: migration_20261014_010551_initial.down,
    name: '20261014_010551_initial',
  },
  {
    up: migration_20261014_011722_categories_body.up,
    down: migration_20261014_011722_categories_body.down,
    name: '20261014_011722_categories_body',
  },
  {
    up: migration_20261014_012616_review_fixes.up,
    down: migration_20261014_012616_review_fixes.down,
    name: '20261014_012616_review_fixes',
  },
  {
    up: migration_20261014_015435_core_collections.up,
    down: migration_20261014_015435_core_collections.down,
    name: '20261014_015435_core_collections',
  },
  {
    up: migration_20261014_021522_globals.up,
    down: migration_20261014_021522_globals.down,
    name: '20261014_021522_globals',
  },
  {
    up: migration_20261014_022343_projects_references_pages.up,
    down: migration_20261014_022343_projects_references_pages.down,
    name: '20261014_022343_projects_references_pages',
  },
  {
    up: migration_20261014_023200_leads.up,
    down: migration_20261014_023200_leads.down,
    name: '20261014_023200_leads',
  },
  {
    up: migration_20261014_024225_ai.up,
    down: migration_20261014_024225_ai.down,
    name: '20261014_024225_ai',
  },
  {
    up: migration_20261014_025409_media_seed_key.up,
    down: migration_20261014_025409_media_seed_key.down,
    name: '20261014_025409_media_seed_key',
  },
  {
    up: migration_20261014_033742_search.up,
    down: migration_20261014_033742_search.down,
    name: '20261014_033742_search',
  },
  {
    up: migration_20261014_043715_lead_consent.up,
    down: migration_20261014_043715_lead_consent.down,
    name: '20261014_043715_lead_consent',
  },
  {
    up: migration_20261014_065329_media_prefix.up,
    down: migration_20261014_065329_media_prefix.down,
    name: '20261014_065329_media_prefix',
  },
  {
    up: migration_20261014_070517_guides.up,
    down: migration_20261014_070517_guides.down,
    name: '20261014_070517_guides',
  },
  {
    up: migration_20261014_075707_home_hero_mobile_image.up,
    down: migration_20261014_075707_home_hero_mobile_image.down,
    name: '20261014_075707_home_hero_mobile_image',
  },
  {
    up: migration_20261014_090734_regions.up,
    down: migration_20261014_090734_regions.down,
    name: '20261014_090734_regions',
  },
  {
    up: migration_20261014_100749_media_w480.up,
    down: migration_20261014_100749_media_w480.down,
    name: '20261014_100749_media_w480',
  },
  {
    up: migration_20261014_130823_media_w800.up,
    down: migration_20261014_130823_media_w800.down,
    name: '20261014_130823_media_w800',
  },
  {
    up: migration_20261014_144607_ru_de_locales.up,
    down: migration_20261014_144607_ru_de_locales.down,
    name: '20261014_144607_ru_de_locales',
  },
  {
    up: migration_20261014_145205_ar_locale.up,
    down: migration_20261014_145205_ar_locale.down,
    name: '20261014_145205_ar_locale',
  },
  {
    up: migration_20261014_161144_media_portrait.up,
    down: migration_20261014_161144_media_portrait.down,
    name: '20261014_161144_media_portrait',
  },
  {
    up: migration_20261014_220922_contact_map.up,
    down: migration_20261014_220922_contact_map.down,
    name: '20261014_220922_contact_map',
  },
  {
    up: migration_20261015_085755_search_guides.up,
    down: migration_20261015_085755_search_guides.down,
    name: '20261015_085755_search_guides',
  },
  {
    up: migration_20261015_085928_guide_cover.up,
    down: migration_20261015_085928_guide_cover.down,
    name: '20261015_085928_guide_cover',
  },
  {
    up: migration_20261016_095824_media_watermark.up,
    down: migration_20261016_095824_media_watermark.down,
    name: '20261016_095824_media_watermark',
  },
  {
    up: migration_20261016_115000_tag_type_axis.up,
    down: migration_20261016_115000_tag_type_axis.down,
    name: '20261016_115000_tag_type_axis',
  },
  {
    up: migration_20261016_235956_hero_slides.up,
    down: migration_20261016_235956_hero_slides.down,
    name: '20261016_235956_hero_slides',
  },
  {
    up: migration_20261017_224837_translate_media.up,
    down: migration_20261017_224837_translate_media.down,
    name: '20261017_224837_translate_media',
  },
  {
    up: migration_20261018_093407_seo_rename.up,
    down: migration_20261018_093407_seo_rename.down,
    name: '20261018_093407_seo_rename',
  },
  {
    up: migration_20261018_095155_seo_retired_stems.up,
    down: migration_20261018_095155_seo_retired_stems.down,
    name: '20261018_095155_seo_retired_stems'
  },
];
