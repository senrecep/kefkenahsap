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
    name: '20261014_090734_regions'
  },
];
