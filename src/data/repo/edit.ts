import { isValidAmount } from '../../domain/money';
import { etcNote } from '../../domain/history';
import { sameName } from '../../domain/name';
import type { DateStr } from '../../domain/date';
import { newId, type FavoritesDB } from '../db';
import type { Category, Detail, Preset, PresetItem, SpendRecord } from '../types';
import { etcDetailOf, ETC, ListError } from './lists';

export class EditError extends Error {
  constructor(public reason: 'amount' | 'refund' | 'list' | 'notFound') {
    super(reason);
  }
}

async function etcCategoryOf(db: FavoritesDB, targetId: string): Promise<Category> {
  const c = (await db.categories.where('targetId').equals(targetId).toArray()).find((x) => x.isEtc);
  if (!c) throw new ListError('notFound');
  return c;
}

const label = (c: Category, d: Detail) => `${c.name} > ${d.name}`;

/**
 * 다른 대상으로 옮길 때 같은 이름(공백 무시)의 분류·세부를 찾고,
 * 없으면 `기타`로 옮기고 기타 내용에 이전 이름을 적습니다.
 */
export async function mapToTarget(db: FavoritesDB, rec: Pick<SpendRecord, 'categoryId' | 'detailId' | 'etcText'>, targetId: string): Promise<Pick<SpendRecord, 'categoryId' | 'detailId' | 'etcText'>> {
  const [oc, od] = await Promise.all([db.categories.get(rec.categoryId), db.details.get(rec.detailId)]);
  if (!oc || !od) throw new EditError('notFound');
  const cats = await db.categories.where('targetId').equals(targetId).toArray();
  const c = cats.find((x) => sameName(x.name, oc.name));
  if (!c) {
    const ec = await etcCategoryOf(db, targetId);
    const ed = await etcDetailOf(db, ec.id);
    return { categoryId: ec.id, detailId: ed.id, etcText: oc.isEtc && od.isEtc ? rec.etcText : etcNote(od.isEtc ? oc.name : label(oc, od), rec.etcText) };
  }
  const dets = await db.details.where('categoryId').equals(c.id).toArray();
  const d = dets.find((x) => sameName(x.name, od.name));
  if (d) return { categoryId: c.id, detailId: d.id, etcText: d.isEtc ? rec.etcText : '' };
  const ed = dets.find((x) => x.isEtc)!;
  return { categoryId: c.id, detailId: ed.id, etcText: etcNote(od.name, rec.etcText) };
}

export interface RecordEdit {
  date: DateStr;
  targetId: string;
  categoryId: string;
  detailId: string;
  paid: number;
  refund: number;
  memo: string;
  etcText: string;
}

/** 기록 수정. 환불은 결제 금액 이하(전액 환불도 기록은 남음). */
export async function updateRecord(db: FavoritesDB, id: string, e: RecordEdit, now = Date.now()): Promise<SpendRecord> {
  if (!isValidAmount(e.paid)) throw new EditError('amount');
  if (!Number.isInteger(e.refund) || e.refund < 0 || e.refund > e.paid) throw new EditError('refund');
  return db.transaction('rw', db.records, db.categories, db.details, async () => {
    const r = await db.records.get(id);
    if (!r) throw new EditError('notFound');
    const [c, d] = await Promise.all([db.categories.get(e.categoryId), db.details.get(e.detailId)]);
    if (!c || !d || c.targetId !== e.targetId || d.categoryId !== c.id) throw new EditError('list');
    const next: SpendRecord = { ...r, ...e, etcText: d.isEtc ? e.etcText.trim() : '', memo: e.memo.trim(), updatedAt: now };
    await db.records.put(next);
    return next;
  });
}

/** 기록을 지우고, 되돌리기에 쓸 원본을 돌려줍니다. */
export async function deleteRecords(db: FavoritesDB, ids: string[]): Promise<SpendRecord[]> {
  return db.transaction('rw', db.records, async () => {
    const rows = (await db.records.bulkGet(ids)).filter((x): x is SpendRecord => !!x);
    await db.records.bulkDelete(ids);
    return rows;
  });
}

export async function restoreRecords(db: FavoritesDB, rows: SpendRecord[]): Promise<void> {
  await db.records.bulkPut(rows);
}

/** 여러 건을 한 번에 옮깁니다. 세부를 고르지 않으면 그 분류의 `기타`이고, 기타 내용에 이전 이름을 적습니다. */
export async function moveRecords(db: FavoritesDB, ids: string[], to: { targetId: string; categoryId: string; detailId?: string }, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.records, db.categories, db.details, async () => {
    const c = await db.categories.get(to.categoryId);
    if (!c || c.targetId !== to.targetId) throw new EditError('list');
    const d = to.detailId ? await db.details.get(to.detailId) : await etcDetailOf(db, c.id);
    if (!d || d.categoryId !== c.id) throw new EditError('list');
    let n = 0;
    for (const id of ids) {
      const r = await db.records.get(id);
      if (!r) continue;
      let etcText = '';
      if (d.isEtc) {
        if (r.detailId === d.id) etcText = r.etcText;
        else {
          const [oc, od] = await Promise.all([db.categories.get(r.categoryId), db.details.get(r.detailId)]);
          etcText = etcNote(oc && od ? (od.isEtc ? oc.name : label(oc, od)) : '', r.etcText);
        }
      }
      await db.records.put({ ...r, targetId: to.targetId, categoryId: c.id, detailId: d.id, etcText, updatedAt: now });
      n++;
    }
    return n;
  });
}

// ── 목록 삭제 (U2-5) ─────────────────────────────────────────

export interface DeleteImpact {
  records: number;
  songs: number;
  details: number;
}

export async function deleteImpact(db: FavoritesDB, kind: 'target' | 'category' | 'detail', id: string): Promise<DeleteImpact> {
  if (kind === 'target') {
    return {
      records: await db.records.where('targetId').equals(id).count(),
      songs: await db.songs.where('targetId').equals(id).count(),
      details: 0,
    };
  }
  if (kind === 'category') {
    return {
      records: await db.records.where('categoryId').equals(id).count(),
      songs: 0,
      details: (await db.details.where('categoryId').equals(id).toArray()).filter((d) => !d.isEtc).length,
    };
  }
  return { records: await db.records.where('detailId').equals(id).count(), songs: 0, details: 0 };
}

/** 대상 삭제: 분류, 세부, 지출 기록, 응원법, 체크 항목, 정기 결제까지 모두 지웁니다. */
export async function deleteTarget(db: FavoritesDB, id: string): Promise<void> {
  await db.transaction('rw', [db.targets, db.categories, db.details, db.records, db.songs, db.songOpens, db.checkItems, db.checkDays, db.recurrings], async () => {
    const t = await db.targets.get(id);
    if (!t) throw new ListError('notFound');
    if (t.isEtc) throw new ListError('etc');
    const cats = await db.categories.where('targetId').equals(id).primaryKeys();
    await db.details.where('categoryId').anyOf(cats).delete();
    await db.categories.bulkDelete(cats);
    await db.records.where('targetId').equals(id).delete();
    const songs = await db.songs.where('targetId').equals(id).primaryKeys();
    await db.songOpens.where('songId').anyOf(songs).delete();
    await db.songs.bulkDelete(songs);
    const items = await db.checkItems.where('targetId').equals(id).primaryKeys();
    await db.checkDays.where('itemId').anyOf(items).delete();
    await db.checkItems.bulkDelete(items);
    await db.recurrings.where('targetId').equals(id).delete();
    await db.targets.delete(id);
  });
}

/** 분류 삭제: 그 대상에서만 사라지고, 기록과 정기 결제는 그 대상의 `기타 › 기타`로 옮깁니다. */
export async function deleteCategory(db: FavoritesDB, id: string, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.categories, db.details, db.records, db.recurrings, async () => {
    const c = await db.categories.get(id);
    if (!c) throw new ListError('notFound');
    if (c.isEtc) throw new ListError('etc');
    const ec = await etcCategoryOf(db, c.targetId);
    const ed = await etcDetailOf(db, ec.id);
    const dets = new Map((await db.details.where('categoryId').equals(id).toArray()).map((d) => [d.id, d]));
    const recs = await db.records.where('categoryId').equals(id).toArray();
    for (const r of recs) {
      const d = dets.get(r.detailId);
      const prev = d && !d.isEtc ? label(c, d) : c.name;
      await db.records.put({ ...r, categoryId: ec.id, detailId: ed.id, etcText: etcNote(prev, r.etcText), updatedAt: now });
    }
    await db.recurrings.where('targetId').equals(c.targetId).filter((x) => x.categoryId === id).modify({ categoryId: ec.id, detailId: ed.id });
    await db.details.bulkDelete([...dets.keys()]);
    await db.categories.delete(id);
    return recs.length;
  });
}

/** 세부 삭제: 그 분류에서만 사라지고, 기록과 정기 결제는 같은 분류의 `기타`로 옮깁니다. */
export async function deleteDetail(db: FavoritesDB, id: string, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.details, db.records, db.recurrings, async () => {
    const d = await db.details.get(id);
    if (!d) throw new ListError('notFound');
    if (d.isEtc) throw new ListError('etc');
    const ed = await etcDetailOf(db, d.categoryId);
    const recs = await db.records.where('detailId').equals(id).toArray();
    for (const r of recs) await db.records.put({ ...r, detailId: ed.id, etcText: etcNote(d.name, r.etcText), updatedAt: now });
    await db.recurrings.filter((x) => x.detailId === id).modify({ detailId: ed.id });
    await db.details.delete(id);
    return recs.length;
  });
}

/** 데이터만 삭제: 항목은 남기고 지출 기록만 지웁니다(대상의 응원법은 그대로). */
export async function clearRecords(db: FavoritesDB, kind: 'target' | 'category' | 'detail', id: string): Promise<number> {
  const key = kind === 'target' ? 'targetId' : kind === 'category' ? 'categoryId' : 'detailId';
  return db.records.where(key).equals(id).delete();
}

// ── 프리셋 (U2-6) ────────────────────────────────────────────

export type PresetChange =
  | { op: 'addCategory'; category: string }
  | { op: 'removeCategory'; category: string }
  | { op: 'addDetail'; category: string; detail: string }
  | { op: 'removeDetail'; category: string; detail: string };

/** 'only' 프리셋에만 / 'all' 이 프리셋으로 만든 대상 전체 / 대상 id 목록 */
export type PresetScope = 'only' | 'all' | string[];

export function applyToItems(items: PresetItem[], ch: PresetChange): PresetItem[] {
  const out = structuredClone(items);
  const find = (n: string) => out.find((x) => sameName(x.name, n));
  switch (ch.op) {
    case 'addCategory': if (!find(ch.category) && !sameName(ch.category, ETC)) out.push({ name: ch.category.trim(), details: [] }); break;
    case 'removeCategory': return out.filter((x) => !sameName(x.name, ch.category));
    case 'addDetail': { const c = find(ch.category); if (c && !c.details.some((d) => sameName(d, ch.detail)) && !sameName(ch.detail, ETC)) c.details.push(ch.detail.trim()); break; }
    case 'removeDetail': { const c = find(ch.category); if (c) c.details = c.details.filter((d) => !sameName(d, ch.detail)); break; }
  }
  return out;
}

export async function presetUsers(db: FavoritesDB, presetId: string): Promise<{ id: string; name: string }[]> {
  return (await db.targets.orderBy('order').toArray()).filter((t) => t.presetId === presetId).map((t) => ({ id: t.id, name: t.name }));
}

/** 프리셋을 고치고, 고른 범위의 대상에도 같게 반영합니다. 추가할 때 같은 이름은 건너뛰고, 뺄 때는 삭제와 같이 기록을 `기타`로 옮깁니다. */
export async function changePreset(db: FavoritesDB, presetId: string, ch: PresetChange, scope: PresetScope): Promise<void> {
  await db.transaction('rw', [db.presets, db.targets, db.categories, db.details, db.records, db.recurrings], () => changePresetTx(db, presetId, ch, scope));
}

async function changePresetTx(db: FavoritesDB, presetId: string, ch: PresetChange, scope: PresetScope): Promise<void> {
  const p = await db.presets.get(presetId);
  if (!p) throw new ListError('notFound');
  await db.presets.put({ ...p, items: applyToItems(p.items, ch) } satisfies Preset);
  if (scope === 'only') return;
  const ids = scope === 'all' ? (await presetUsers(db, presetId)).map((x) => x.id) : scope;
  for (const tid of ids) {
    const cats = await db.categories.where('targetId').equals(tid).toArray();
    const cat = cats.find((c) => sameName(c.name, ch.category));
    if (ch.op === 'addCategory') {
      if (!cat) {
        const max = Math.max(0, ...cats.map((c) => c.order));
        const etc = cats.find((c) => c.isEtc);
        const atEnd = etc && etc.order === max;
        if (atEnd) await db.categories.update(etc.id, { order: max + 1 });
        const nc: Category = { id: newId(), targetId: tid, name: ch.category.trim(), order: atEnd ? max : max + 1, isEtc: false };
        await db.categories.add(nc);
        await db.details.add({ id: newId(), categoryId: nc.id, name: ETC, order: 1, isEtc: true });
      }
    } else if (ch.op === 'removeCategory') {
      if (cat && !cat.isEtc) await deleteCategory(db, cat.id);
    } else if (cat) {
      const dets = await db.details.where('categoryId').equals(cat.id).toArray();
      const det = dets.find((d) => sameName(d.name, ch.detail));
      if (ch.op === 'addDetail' && !det) {
        const max = Math.max(0, ...dets.map((d) => d.order));
        const etc = dets.find((d) => d.isEtc);
        const atEnd = etc && etc.order === max;
        if (atEnd) await db.details.update(etc.id, { order: max + 1 });
        await db.details.add({ id: newId(), categoryId: cat.id, name: ch.detail.trim(), order: atEnd ? max : max + 1, isEtc: false });
      } else if (ch.op === 'removeDetail' && det && !det.isEtc) {
        await deleteDetail(db, det.id);
      }
    }
  }
}

export async function addPreset(db: FavoritesDB, rawName: string): Promise<Preset> {
  const all = await db.presets.toArray();
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) throw new ListError('empty');
  if (all.some((p) => sameName(p.name, name))) throw new ListError('duplicate');
  const p: Preset = { id: newId(), name, items: [], order: Math.max(0, ...all.map((x) => x.order)) + 1 };
  await db.presets.add(p);
  return p;
}
