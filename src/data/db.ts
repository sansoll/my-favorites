import Dexie, { type EntityTable } from 'dexie';
import type {
  Blob_, Category, CategoryColor, CheckDay, CheckItem, Detail, Place, Preset, Recurring,
  Setting, Song, SongOpen, SpendRecord, Target, Theme,
} from './types';

/** 미리보기 빌드는 저장소를 따로 써서 본 앱 데이터에 영향을 주지 않습니다. */
export const DB_NAME = __PREVIEW__ ? 'my-favorites-preview' : 'my-favorites';

/**
 * 저장 구조 v1 (DESIGN 3장).
 * 구조를 바꿀 때는 아래 SCHEMA에 새 버전을 더하고, 필요하면 upgrade로 기존 데이터를 옮깁니다.
 * 이미 내보낸 버전은 절대 고치지 않습니다.
 */
export const SCHEMA_V1 = {
  targets: 'id, order',
  categories: 'id, targetId, [targetId+order]',
  details: 'id, categoryId, [categoryId+order]',
  records: 'id, date, targetId, categoryId, detailId, placeId, recurringId',
  recurrings: 'id, targetId',
  places: 'id, [source+externalId], name',
  presets: 'id, order',
  songs: 'id, targetId, title',
  songOpens: 'id, songId, at',
  checkItems: 'id, targetId, order',
  checkDays: 'id, itemId, date, [itemId+date]',
  themes: 'id',
  categoryColors: 'name',
  blobs: 'id, kind',
  settings: 'key',
} as const;

export const STORE_NAMES = Object.keys(SCHEMA_V1) as (keyof typeof SCHEMA_V1)[];
export const DB_VERSION = 1;

export class FavoritesDB extends Dexie {
  targets!: EntityTable<Target, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  details!: EntityTable<Detail, 'id'>;
  records!: EntityTable<SpendRecord, 'id'>;
  recurrings!: EntityTable<Recurring, 'id'>;
  places!: EntityTable<Place, 'id'>;
  presets!: EntityTable<Preset, 'id'>;
  songs!: EntityTable<Song, 'id'>;
  songOpens!: EntityTable<SongOpen, 'id'>;
  checkItems!: EntityTable<CheckItem, 'id'>;
  checkDays!: EntityTable<CheckDay, 'id'>;
  themes!: EntityTable<Theme, 'id'>;
  categoryColors!: EntityTable<CategoryColor, 'name'>;
  blobs!: EntityTable<Blob_, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

let instance: FavoritesDB | null = null;

/** 앱 전체가 같이 쓰는 저장소. 테스트에서는 setDb로 바꿔 끼웁니다. */
export function getDb(): FavoritesDB {
  if (!instance) instance = new FavoritesDB();
  return instance;
}

export function setDb(db: FavoritesDB | null): void {
  instance = db;
}
