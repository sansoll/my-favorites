import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import { monthOf, monthRange, parseDateStr, today } from '../domain/date';
import { monthTotals, type MonthTotals } from '../domain/totals';

const EMPTY: MonthTotals = { total: 0, byTarget: new Map(), byCategory: new Map(), byDetail: new Map() };

/** 이번 달 금액(결제 − 환불). 기록이 바뀌면 다시 계산됩니다. */
export function useMonthTotals(todayStr: string = today()): MonthTotals {
  const { y, m } = parseDateStr(todayStr);
  const r = monthRange(y, m);
  return useLiveQuery(async () => monthTotals(await getDb().records.where('date').between(r.start, r.end, true, true).toArray(), monthOf(todayStr)), [r.start]) ?? EMPTY;
}
