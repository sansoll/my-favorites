import type { SpendRecord } from '../data/types';
import { monthOf, type MonthStr } from './date';

export const net = (r: Pick<SpendRecord, 'paid' | 'refund'>) => r.paid - r.refund;

export interface MonthTotals {
  total: number;
  byTarget: Map<string, number>;
  byCategory: Map<string, number>;
  byDetail: Map<string, number>;
}

/** 이번 달 금액 집계: 결제 − 환불. 날짜가 속한 달로 세고 예정 기록도 포함합니다. */
export function monthTotals(records: SpendRecord[], month: MonthStr): MonthTotals {
  const t: MonthTotals = { total: 0, byTarget: new Map(), byCategory: new Map(), byDetail: new Map() };
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const r of records) {
    if (monthOf(r.date) !== month) continue;
    const v = net(r);
    t.total += v;
    add(t.byTarget, r.targetId, v);
    add(t.byCategory, r.categoryId, v);
    add(t.byDetail, r.detailId, v);
  }
  return t;
}
