import { STORE_NAMES, type FavoritesDB } from './db';
import { ensureInitialData } from './repo/lists';
import { getSetting, setSetting } from './settings';

/**
 * 내보내기·불러오기(U7-1, U7-2)와 모든 데이터 지우기(U7-3).
 * 파일 하나(JSON)에 버전 번호를 넣고, 사진(대상 사진·달력 표지)과 글꼴(`blobs`)은 넣지 않습니다.
 */

export const BACKUP_APP = 'my-favorites';
/** 내보내기 파일 구조 버전. 구조를 바꾸면 올리고 MIGRATIONS에 변환을 더합니다. 이미 낸 버전은 고치지 않습니다. */
export const BACKUP_VERSION = 1;
/** 불러오기 파일 크기 상한 */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** 내보내기에 들어가는 저장소(blobs 제외) */
export const EXPORT_STORES = STORE_NAMES.filter((n) => n !== 'blobs');
export type ExportStore = (typeof EXPORT_STORES)[number];

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<ExportStore, Record<string, unknown>[]>;
}

export const LAST_EXPORT_KEY = 'lastExportAt';

export async function exportData(db: FavoritesDB, now = new Date()): Promise<BackupFile> {
  const data = {} as BackupFile['data'];
  await db.transaction('r', EXPORT_STORES.map((n) => db.table(n)), async () => {
    for (const n of EXPORT_STORES) data[n] = (await db.table(n).toArray()).filter((row) => !(n === 'settings' && row.key === LAST_EXPORT_KEY));
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function exportFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `my-favorites-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export async function exportText(db: FavoritesDB, now = new Date()): Promise<string> {
  const text = JSON.stringify(await exportData(db, now));
  await setSetting(db, LAST_EXPORT_KEY, now.getTime());
  return text;
}

export async function lastExportAt(db: FavoritesDB): Promise<number | null> {
  return getSetting<number | null>(db, LAST_EXPORT_KEY, null);
}

// ───────────── 불러오기 검사 ─────────────

export class BackupError extends Error {}

type Kind = 'str' | 'num' | 'int' | 'bool' | 'obj' | 'arr' | 'any';
/** 필드 이름 끝의 `?`는 없어도 되는 필드 */
type Shape = Record<string, Kind>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const SHAPES: Record<ExportStore, Shape> = {
  targets: { id: 'str', name: 'str', color: 'str', 'photoId?': 'str', order: 'num', 'presetId?': 'str', isEtc: 'bool' },
  categories: { id: 'str', targetId: 'str', name: 'str', order: 'num', isEtc: 'bool' },
  details: { id: 'str', categoryId: 'str', name: 'str', order: 'num', isEtc: 'bool' },
  records: {
    id: 'str', date: 'str', targetId: 'str', categoryId: 'str', detailId: 'str', etcText: 'str', paid: 'int', refund: 'int', memo: 'str',
    'placeId?': 'str', 'recurringId?': 'str', createdAt: 'num', updatedAt: 'num',
  },
  recurrings: { id: 'str', targetId: 'str', categoryId: 'str', detailId: 'str', amount: 'int', day: 'int', enabled: 'bool', lastMonth: 'str' },
  places: { id: 'str', source: 'str', externalId: 'str', name: 'str', 'displayName?': 'str' },
  presets: { id: 'str', name: 'str', items: 'arr', order: 'num' },
  songs: { id: 'str', targetId: 'str', title: 'str', lyrics: 'str', layer: 'obj', links: 'arr', createdAt: 'num' },
  songOpens: { id: 'str', songId: 'str', at: 'num' },
  checkItems: { id: 'str', targetId: 'str', name: 'str', 'color?': 'str', on: 'bool', order: 'num', 'cover?': 'obj', 'notifyApp?': 'str' },
  checkDays: { id: 'str', itemId: 'str', date: 'str', 'count?': 'int', source: 'str', 'dismissed?': 'bool' },
  themes: { id: 'str', name: 'str', bg: 'str', surface: 'str', accent: 'str', accent2: 'str', text: 'str' },
  categoryColors: { name: 'str', color: 'str' },
  settings: { key: 'str', value: 'any' },
};

const KEY_OF: Partial<Record<ExportStore, string>> = { categoryColors: 'name', settings: 'key' };

function isKind(v: unknown, k: Kind): boolean {
  switch (k) {
    case 'str': return typeof v === 'string' && v.length <= 100_000;
    case 'num': return typeof v === 'number' && Number.isFinite(v);
    case 'int': return Number.isSafeInteger(v);
    case 'bool': return typeof v === 'boolean';
    case 'obj': return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'arr': return Array.isArray(v);
    case 'any': return v !== undefined;
  }
}

function checkRow(store: ExportStore, row: unknown, i: number): Record<string, unknown> {
  const where = `${store} ${i + 1}번째`;
  if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new BackupError(`${where} 항목이 올바르지 않아요.`);
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [raw, kind] of Object.entries(SHAPES[store])) {
    const optional = raw.endsWith('?');
    const f = optional ? raw.slice(0, -1) : raw;
    const v = r[f];
    if (v === undefined || (optional && v === null)) {
      if (optional) continue;
      throw new BackupError(`${where} 항목에 ${f}가 없어요.`);
    }
    if (!isKind(v, kind)) throw new BackupError(`${where} 항목의 ${f}가 올바르지 않아요.`);
    out[f] = v;
  }
  // 알 수 없는 필드는 버립니다(필요한 것만 저장).
  return out;
}

function fail(msg: string): never { throw new BackupError(msg); }

/** 구조를 하나하나 검사합니다. 틀리면 BackupError를 던지고, 통과하면 저장할 데이터만 돌려줍니다. */
export function validateBackup(raw: unknown, migrations: Migrations = MIGRATIONS, current = BACKUP_VERSION): BackupFile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('이 앱에서 내보낸 파일이 아니에요.');
  const f = raw as Record<string, unknown>;
  if (f.app !== BACKUP_APP) fail('이 앱에서 내보낸 파일이 아니에요.');
  if (!Number.isInteger(f.version) || (f.version as number) < 1) fail('파일 버전을 알 수 없어요.');
  if ((f.version as number) > current) fail('더 새 버전의 앱에서 내보낸 파일이에요. 앱을 업데이트한 뒤 불러와 주세요.');
  if (typeof f.data !== 'object' || f.data === null || Array.isArray(f.data)) fail('파일 안에 데이터가 없어요.');

  // 예전 버전 파일은 지금 버전으로 바꿉니다.
  let data = f.data as Record<string, unknown>;
  for (let v = f.version as number; v < current; v++) {
    const m = migrations[v];
    if (!m) fail('파일 버전을 바꿀 수 없어요.');
    data = m(data);
  }

  const out = {} as BackupFile['data'];
  for (const store of EXPORT_STORES) {
    const rows = data[store] ?? [];
    if (!Array.isArray(rows)) fail(`${store} 데이터가 올바르지 않아요.`);
    out[store] = rows.map((row, i) => checkRow(store, row, i));
    const key = KEY_OF[store] ?? 'id';
    const seen = new Set<unknown>();
    for (const r of out[store]) {
      if (seen.has(r[key])) fail(`${store}에 같은 번호가 두 번 있어요.`);
      seen.add(r[key]);
    }
  }
  checkLinks(out);
  return { app: BACKUP_APP, version: current, exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : '', data: out };
}

/** 기록과 목록이 서로 가리키는 대상이 실제로 있는지 봅니다. */
function checkLinks(d: BackupFile['data']): void {
  const ids = (s: ExportStore) => new Set(d[s].map((r) => r.id));
  const targets = ids('targets');
  const categories = ids('categories');
  const details = ids('details');
  const places = ids('places');
  const items = ids('checkItems');
  const songs = ids('songs');
  const need = (ok: boolean, msg: string) => { if (!ok) fail(msg); };
  for (const c of d.categories) need(targets.has(c.targetId), '분류가 가리키는 대상이 없어요.');
  for (const x of d.details) need(categories.has(x.categoryId), '세부가 가리키는 분류가 없어요.');
  for (const r of d.records) {
    need(DATE.test(r.date as string), '기록 날짜가 올바르지 않아요.');
    need(targets.has(r.targetId) && categories.has(r.categoryId) && details.has(r.detailId), '기록이 가리키는 목록이 없어요.');
    need(r.placeId === undefined || places.has(r.placeId), '기록이 가리키는 장소가 없어요.');
  }
  for (const r of d.recurrings) need(targets.has(r.targetId) && categories.has(r.categoryId) && details.has(r.detailId), '정기 결제가 가리키는 목록이 없어요.');
  for (const c of d.checkItems) need(targets.has(c.targetId), '체크 항목이 가리키는 대상이 없어요.');
  for (const c of d.checkDays) {
    need(items.has(c.itemId), '체크 기록이 가리키는 항목이 없어요.');
    need(DATE.test(c.date as string), '체크 날짜가 올바르지 않아요.');
  }
  for (const s of d.songs) need(targets.has(s.targetId), '곡이 가리키는 대상이 없어요.');
  for (const o of d.songOpens) need(songs.has(o.songId), '곡 열기 기록이 가리키는 곡이 없어요.');
  for (const p of d.places) need(['kakao', 'osm', 'name'].includes(p.source as string), '장소 출처가 올바르지 않아요.');
}

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
/** MIGRATIONS[v]: 버전 v 파일을 v+1로 바꿉니다. */
export type Migrations = Record<number, Migration>;
export const MIGRATIONS: Migrations = {};

/** 파일 글자를 읽어 검사합니다. 크기 상한을 넘거나 JSON이 아니면 BackupError. */
export function parseBackup(text: string, migrations?: Migrations): BackupFile {
  if (text.length > MAX_IMPORT_BYTES) throw new BackupError('파일이 너무 커요. 20MB 이하만 불러올 수 있어요.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new BackupError('파일을 읽을 수 없어요. 내보낸 JSON 파일을 골라 주세요.'); }
  return validateBackup(raw, migrations);
}

export async function readBackupFile(file: Blob, migrations?: Migrations): Promise<BackupFile> {
  if (file.size > MAX_IMPORT_BYTES) throw new BackupError('파일이 너무 커요. 20MB 이하만 불러올 수 있어요.');
  return parseBackup(await file.text(), migrations);
}

/**
 * 검사를 통과한 데이터로 지금 데이터를 덮어씁니다(한 번에, 실패하면 그대로).
 * 사진·글꼴(blobs)은 파일에 없으므로 남겨 두고, 이 폰에 없는 사진을 가리키면 그 연결만 뺍니다.
 */
export async function importData(db: FavoritesDB, backup: BackupFile): Promise<void> {
  await db.transaction('rw', STORE_NAMES.map((n) => db.table(n)), async () => {
    const blobIds = new Set((await db.blobs.toCollection().primaryKeys()) as string[]);
    const lastExport = await db.settings.get(LAST_EXPORT_KEY);
    for (const n of EXPORT_STORES) {
      await db.table(n).clear();
      let rows = backup.data[n];
      if (n === 'targets') rows = rows.map((t) => (t.photoId && !blobIds.has(t.photoId as string) ? { ...t, photoId: undefined } : t));
      if (n === 'checkItems') rows = rows.map((c) => (c.cover ? { ...c, cover: pruneCover(c.cover as CoverLike, blobIds) } : c));
      await db.table(n).bulkAdd(rows);
    }
    if (lastExport) await db.settings.put(lastExport);
  });
  await ensureInitialData(db);
}

interface CoverLike { all?: unknown; months?: unknown; bg?: unknown }

function pruneCover(c: CoverLike, blobIds: Set<string>) {
  const keep = (v: unknown) => (typeof v === 'string' && blobIds.has(v) ? v : null);
  const months: Record<string, string | null> = {};
  if (typeof c.months === 'object' && c.months !== null) {
    for (const [k, v] of Object.entries(c.months)) if (v === null || keep(v)) months[k] = keep(v);
  }
  return { all: keep(c.all), months, bg: c.bg !== false };
}

/** 모든 데이터 지우기: 모든 저장소(사진·글꼴 포함)를 비우고 처음 상태(`기타`만)로 돌립니다. */
export async function wipeAll(db: FavoritesDB): Promise<void> {
  await db.transaction('rw', STORE_NAMES.map((n) => db.table(n)), async () => {
    for (const n of STORE_NAMES) await db.table(n).clear();
  });
  await ensureInitialData(db);
}
