import { checkName } from '../../domain/name';
import { canCheck } from '../../domain/check';
import { today, type DateStr, type MonthStr } from '../../domain/date';
import { newId, type FavoritesDB } from '../db';
import type { CheckCover, CheckDay, CheckItem } from '../types';

export class CheckError extends Error {
  constructor(public reason: 'empty' | 'duplicate' | 'future' | 'notFound') {
    super(reason);
  }
}

export async function listCheckItems(db: FavoritesDB, onlyOn = false): Promise<CheckItem[]> {
  const [items, targets] = await Promise.all([db.checkItems.orderBy('order').toArray(), db.targets.toArray()]);
  const tOrder = new Map(targets.map((t) => [t.id, t.order]));
  return items.filter((x) => !onlyOn || x.on).sort((a, b) => a.order - b.order || (tOrder.get(a.targetId) ?? 0) - (tOrder.get(b.targetId) ?? 0));
}

/** 새 체크 항목: 대상 + 이름. 같은 대상에 공백만 다른 같은 이름은 거부합니다(U4-1). */
export async function addCheckItem(db: FavoritesDB, targetId: string, name: string): Promise<CheckItem> {
  return db.transaction('rw', db.checkItems, db.targets, async () => {
    if (!(await db.targets.get(targetId))) throw new CheckError('notFound');
    const all = await db.checkItems.toArray();
    const same = all.filter((x) => x.targetId === targetId).map((x) => x.name);
    const c = checkName(name, same);
    if (!c.ok) throw new CheckError(c.reason === 'empty' ? 'empty' : 'duplicate');
    const item: CheckItem = { id: newId(), targetId, name: c.name, on: true, order: Math.max(0, ...all.map((x) => x.order)) + 1 };
    await db.checkItems.add(item);
    return item;
  });
}

export async function setCheckItemOn(db: FavoritesDB, id: string, on: boolean): Promise<void> {
  if (!(await db.checkItems.update(id, { on }))) throw new CheckError('notFound');
}

async function dayRow(db: FavoritesDB, itemId: string, date: DateStr): Promise<CheckDay | undefined> {
  return db.checkDays.where('[itemId+date]').equals([itemId, date]).first();
}

export function isOn(d: CheckDay | undefined): boolean {
  return !!d && !d.dismissed;
}

/**
 * 그 날을 체크하거나 지웁니다. 미래 날짜는 체크하지 않습니다. 직접 체크는 횟수 없이 저장합니다.
 * 2단계 자동 체크로 들어온 날을 지우면 지우지 않고 `dismissed`로 남겨, 자동으로 다시 채우지 않게 합니다.
 * 돌려주는 값은 바뀐 뒤 체크됐는지입니다.
 */
export async function toggleCheck(db: FavoritesDB, itemId: string, date: DateStr, todayStr: DateStr = today()): Promise<boolean> {
  if (!canCheck(date, todayStr)) throw new CheckError('future');
  return db.transaction('rw', db.checkDays, db.checkItems, async () => {
    if (!(await db.checkItems.get(itemId))) throw new CheckError('notFound');
    const d = await dayRow(db, itemId, date);
    if (!d) {
      await db.checkDays.add({ id: newId(), itemId, date, source: 'manual' });
      return true;
    }
    if (d.dismissed) {
      await db.checkDays.update(d.id, { dismissed: false });
      return true;
    }
    if (d.source === 'auto') await db.checkDays.update(d.id, { dismissed: true });
    else await db.checkDays.delete(d.id);
    return false;
  });
}

/** 체크한 날짜(지운 날 제외). */
export async function checkedDates(db: FavoritesDB, itemId: string): Promise<Set<DateStr>> {
  const rows = await db.checkDays.where('itemId').equals(itemId).toArray();
  return new Set(rows.filter((r) => !r.dismissed).map((r) => r.date));
}

/** 여러 항목의 오늘 체크 여부. */
export async function checkedOn(db: FavoritesDB, itemIds: string[], date: DateStr): Promise<Set<string>> {
  const rows = await db.checkDays.where('date').equals(date).toArray();
  const want = new Set(itemIds);
  return new Set(rows.filter((r) => !r.dismissed && want.has(r.itemId)).map((r) => r.itemId));
}

const EMPTY_COVER: CheckCover = { all: null, months: {}, bg: true };

/**
 * 표지 바꾸기. scope가 'all'이면 모든 달, 'month'면 그 달만.
 * 모든 달 표지를 없음으로 하면 달마다 정한 것도 지웁니다. 처음 넣을 때 기본 보기는 사진 창문입니다.
 */
export async function setCover(db: FavoritesDB, itemId: string, photoId: string | null, scope: 'all' | 'month', ym: MonthStr): Promise<void> {
  await db.transaction('rw', db.checkItems, async () => {
    const it = await db.checkItems.get(itemId);
    if (!it) throw new CheckError('notFound');
    const c = it.cover ?? EMPTY_COVER;
    const next: CheckCover = scope === 'month' ? { ...c, months: { ...c.months, [ym]: photoId } } : { ...c, all: photoId, months: photoId === null ? {} : c.months };
    await db.checkItems.update(itemId, { cover: next });
  });
}

export async function setCoverWindow(db: FavoritesDB, itemId: string, bg: boolean): Promise<void> {
  await db.transaction('rw', db.checkItems, async () => {
    const it = await db.checkItems.get(itemId);
    if (!it) throw new CheckError('notFound');
    await db.checkItems.update(itemId, { cover: { ...(it.cover ?? EMPTY_COVER), bg } });
  });
}

/** 사진 저장(이미 줄인 것). */
export async function savePhoto(db: FavoritesDB, data: Blob, width: number, height: number, name = '사진'): Promise<string> {
  const id = newId();
  await db.blobs.add({ id, kind: 'photo', name, data, width, height });
  return id;
}

export async function listPhotos(db: FavoritesDB) {
  return db.blobs.where('kind').equals('photo').toArray();
}
