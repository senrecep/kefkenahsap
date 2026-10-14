import * as migration_20261014_010551_initial from './20261014_010551_initial';
import * as migration_20261014_011722_categories_body from './20261014_011722_categories_body';
import * as migration_20261014_012616_review_fixes from './20261014_012616_review_fixes';
import * as migration_20261014_015435_core_collections from './20261014_015435_core_collections';

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
    name: '20261014_015435_core_collections'
  },
];
