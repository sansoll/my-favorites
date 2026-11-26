import { isValidAmount } from '../../domain/money';
import { today, type DateStr } from '../../domain/date';
import { newId, type FavoritesDB } from '../db';
import { requestPersistOnce } from '../persist';
import type { SpendRecord } from '../types';
import { etcDetailOf } from './lists';

export interface SaveRecordInput {
  targetId: string;
  categoryId: string;
  /** 건너뛰면 그 분류의 `기타` */
  detailId?: string;
  paid: number;
  date?: DateStr;
  etcText?: string;
  memo?: string;
  placeId?: string;
  recurringId?: string;
}

export class RecordError extends Error {
  constructor(public reason: 'amount' | 'list') {
    super(reason);
  }
}

/**
 * 기록 저장은 모두 이 함수 하나로 합니다(DESIGN 8장, 2단계 위젯도 같은 함수를 씀).
 * 금액이 0이면 저장하지 않고, 세부를 건너뛰면 그 분류의 `기타`로 저장합니다.
 * 기타 내용은 세부가 `기타`일 때만 남깁니다.
 */
export async function saveRecord(db: FavoritesDB, input: SaveRecordInput, now: number = Date.now()): Promise<SpendRecord> {
  if (!isValidAmount(input.paid)) throw new RecordError('amount');
  const rec = await db.transaction('rw', db.records, db.targets, db.categories, db.details, async () => {
    const [t, c] = await Promise.all([db.targets.get(input.targetId), db.categories.get(input.categoryId)]);
    if (!t || !c || c.targetId !== t.id) throw new RecordError('list');
    const d = input.detailId ? await db.details.get(input.detailId) : await etcDetailOf(db, c.id);
    if (!d || d.categoryId !== c.id) throw new RecordError('list');
    const r: SpendRecord = {
      id: newId(),
      date: input.date ?? today(),
      targetId: t.id,
      categoryId: c.id,
      detailId: d.id,
      etcText: d.isEtc ? (input.etcText ?? '').trim() : '',
      paid: input.paid,
      refund: 0,
      memo: (input.memo ?? '').trim(),
      placeId: input.placeId,
      recurringId: input.recurringId,
      createdAt: now,
      updatedAt: now,
    };
    await db.records.add(r);
    return r;
  });
  await requestPersistOnce(db);
  return rec;
}

/** 최근 기록: 날짜가 늦은 순, 같은 날이면 나중에 넣은 순. 예정(미래) 기록은 뺍니다. */
export async function recentRecords(db: FavoritesDB, limit: number, todayStr: DateStr = today()): Promise<SpendRecord[]> {
  const rows = await db.records.where('date').belowOrEqual(todayStr).toArray();
  return rows.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, limit);
}
