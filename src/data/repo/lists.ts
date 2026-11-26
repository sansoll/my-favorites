import { nextTargetColor, ETC_COLOR } from '../../domain/colors';
import { checkName } from '../../domain/name';
import { newId, type FavoritesDB } from '../db';
import type { Category, Detail, PresetItem, Target } from '../types';

export const ETC = '기타';

export class ListError extends Error {
  constructor(public reason: 'empty' | 'duplicate' | 'etc' | 'notFound') {
    super(reason);
  }
}

const unwrap = (name: string, existing: string[]) => {
  const c = checkName(name, existing);
  if (!c.ok) throw new ListError(c.reason);
  return c.name;
};

/** 새 항목은 맨 뒤에 넣되, `기타`가 맨 뒤에 있으면 그 앞에 넣습니다. */
const orderBeforeEtc = (items: { order: number; isEtc: boolean }[]) => {
  const max = items.length ? Math.max(...items.map((x) => x.order)) : 0;
  const etc = items.find((x) => x.isEtc);
  if (etc && etc.order === max) return { order: max, bumpEtc: max + 1 };
  return { order: max + 1, bumpEtc: null };
};

async function addDetailRow(db: FavoritesDB, categoryId: string, name: string, order: number, isEtc: boolean): Promise<Detail> {
  const d: Detail = { id: newId(), categoryId, name, order, isEtc };
  await db.details.add(d);
  return d;
}

async function addCategoryRow(db: FavoritesDB, targetId: string, name: string, order: number, isEtc: boolean, details: string[] = []): Promise<Category> {
  const c: Category = { id: newId(), targetId, name, order, isEtc };
  await db.categories.add(c);
  let i = 1;
  for (const d of details) {
    if (d.replace(/\s/g, '') === ETC) continue;
    await addDetailRow(db, c.id, d, i++, false);
  }
  await addDetailRow(db, c.id, ETC, i, true);
  return c;
}

/** 처음 실행하면 대상 `기타`(분류 `기타`, 세부 `기타`)만 있습니다. */
export async function ensureInitialData(db: FavoritesDB): Promise<void> {
  await db.transaction('rw', db.targets, db.categories, db.details, async () => {
    if ((await db.targets.count()) > 0) return;
    const t: Target = { id: newId(), name: ETC, color: ETC_COLOR, order: 1, isEtc: true };
    await db.targets.add(t);
    await addCategoryRow(db, t.id, ETC, 1, true);
  });
}

/** 대상을 만들면 분류 `기타`와 세부 `기타`가 자동으로 생깁니다. 프리셋을 고르면 그 분류·세부를 복사해 넣습니다. */
export async function addTarget(db: FavoritesDB, rawName: string, preset?: { id: string; items: PresetItem[] }): Promise<Target> {
  return db.transaction('rw', db.targets, db.categories, db.details, async () => {
    const all = await db.targets.toArray();
    const name = unwrap(rawName, all.map((t) => t.name));
    const { order, bumpEtc } = orderBeforeEtc(all);
    const etc = all.find((t) => t.isEtc);
    if (etc && bumpEtc !== null) await db.targets.update(etc.id, { order: bumpEtc });
    const t: Target = { id: newId(), name, color: nextTargetColor(all.map((x) => x.color)), order, isEtc: false, presetId: preset?.id };
    await db.targets.add(t);
    let i = 1;
    for (const item of preset?.items ?? []) {
      if (item.name.replace(/\s/g, '') === ETC) continue;
      await addCategoryRow(db, t.id, item.name, i++, false, item.details);
    }
    await addCategoryRow(db, t.id, ETC, i, true);
    return t;
  });
}

export async function addCategory(db: FavoritesDB, targetId: string, rawName: string): Promise<Category> {
  return db.transaction('rw', db.categories, db.details, async () => {
    const all = await db.categories.where('targetId').equals(targetId).toArray();
    const name = unwrap(rawName, all.map((c) => c.name));
    const { order, bumpEtc } = orderBeforeEtc(all);
    const etc = all.find((c) => c.isEtc);
    if (etc && bumpEtc !== null) await db.categories.update(etc.id, { order: bumpEtc });
    return addCategoryRow(db, targetId, name, order, false);
  });
}

export async function addDetail(db: FavoritesDB, categoryId: string, rawName: string): Promise<Detail> {
  return db.transaction('rw', db.details, async () => {
    const all = await db.details.where('categoryId').equals(categoryId).toArray();
    const name = unwrap(rawName, all.map((d) => d.name));
    const { order, bumpEtc } = orderBeforeEtc(all);
    const etc = all.find((d) => d.isEtc);
    if (etc && bumpEtc !== null) await db.details.update(etc.id, { order: bumpEtc });
    return addDetailRow(db, categoryId, name, order, false);
  });
}

export type ListKind = 'target' | 'category' | 'detail';

const tableOf = (db: FavoritesDB, kind: ListKind) => (kind === 'target' ? db.targets : kind === 'category' ? db.categories : db.details);

async function siblings(db: FavoritesDB, kind: ListKind, id: string): Promise<{ id: string; name: string; isEtc: boolean }[]> {
  if (kind === 'target') return db.targets.toArray();
  if (kind === 'category') {
    const c = await db.categories.get(id);
    if (!c) throw new ListError('notFound');
    return db.categories.where('targetId').equals(c.targetId).toArray();
  }
  const d = await db.details.get(id);
  if (!d) throw new ListError('notFound');
  return db.details.where('categoryId').equals(d.categoryId).toArray();
}

/** 이름을 바꿉니다. 기록은 id로 가리키므로 지난 기록에도 새 이름이 보입니다. `기타`는 이름을 바꿀 수 없습니다. */
export async function renameItem(db: FavoritesDB, kind: ListKind, id: string, rawName: string): Promise<string> {
  const sibs = await siblings(db, kind, id);
  const me = sibs.find((x) => x.id === id);
  if (!me) throw new ListError('notFound');
  if (me.isEtc) throw new ListError('etc');
  const name = unwrap(rawName, sibs.filter((x) => x.id !== id).map((x) => x.name));
  await tableOf(db, kind).update(id, { name });
  return name;
}

/** ids 순서대로 order를 다시 매깁니다. */
export async function reorderItems(db: FavoritesDB, kind: ListKind, ids: string[]): Promise<void> {
  const table = tableOf(db, kind);
  await db.transaction('rw', table, async () => {
    for (let i = 0; i < ids.length; i++) await table.update(ids[i], { order: i + 1 });
  });
}

export async function listTargets(db: FavoritesDB): Promise<Target[]> {
  return db.targets.orderBy('order').toArray();
}

export async function listCategories(db: FavoritesDB, targetId: string): Promise<Category[]> {
  return db.categories.where('[targetId+order]').between([targetId, -Infinity], [targetId, Infinity]).toArray();
}

export async function listDetails(db: FavoritesDB, categoryId: string): Promise<Detail[]> {
  return db.details.where('[categoryId+order]').between([categoryId, -Infinity], [categoryId, Infinity]).toArray();
}

export async function etcDetailOf(db: FavoritesDB, categoryId: string): Promise<Detail> {
  const d = (await db.details.where('categoryId').equals(categoryId).toArray()).find((x) => x.isEtc);
  if (!d) throw new ListError('notFound');
  return d;
}
