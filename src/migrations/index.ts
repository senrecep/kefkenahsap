import * as migration_20261014_010551_initial from './20261014_010551_initial';
import * as migration_20261014_011722_categories_body from './20261014_011722_categories_body';

export const migrations = [
  {
    up: migration_20261014_010551_initial.up,
    down: migration_20261014_010551_initial.down,
    name: '20261014_010551_initial',
  },
  {
    up: migration_20261014_011722_categories_body.up,
    down: migration_20261014_011722_categories_body.down,
    name: '20261014_011722_categories_body'
  },
];
