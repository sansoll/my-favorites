import type { SpendRecord } from '../data/types';
import { addMonths, inRange, monthRange, parseDateStr, today, yearRange, type DateStr } from './date';

export type Period = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

export const PERIOD_LABELS: Record<Period, string> = {
  all: '전체 기간',
  thisMonth: '이번 달',
  lastMonth: '지난달',
  thisYear: '올해',
  lastYear: '지난해',
};

export function periodRange(p: Period, todayStr: DateStr = today()): { start: DateStr; end: DateStr } | null {
  const { y, m } = parseDateStr(todayStr);
  switch (p) {
    case 'all': return null;
    case 'thisMonth': return monthRange(y, m);
    case 'lastMonth': { const x = addMonths(y, m, -1); return monthRange(x.y, x.m); }
    case 'thisYear': return yearRange(y);
    case 'lastYear': return yearRange(y - 1);
  }
}

export interface HistoryFilter {
  targetId: string | null;
  period: Period;
}

/** 최신 날짜순(같은 날이면 나중에 넣은 순)으로, 날짜별로 묶습니다. */
export function groupHistory(records: SpendRecord[], f: HistoryFilter, todayStr: DateStr = today()): { date: DateStr; records: SpendRecord[] }[] {
  const range = periodRange(f.period, todayStr);
  const rows = records
    .filter((r) => (!f.targetId || r.targetId === f.targetId) && (!range || inRange(r.date, range)))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  const out: { date: DateStr; records: SpendRecord[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.date === r.date) last.records.push(r);
    else out.push({ date: r.date, records: [r] });
  }
  return out;
}

/** 기타로 옮길 때 기타 내용에 남길 글: 이전 이름을 앞에, 원래 있던 기타 내용은 뒤에. */
export function etcNote(previous: string, existing: string): string {
  return [previous, existing.trim()].filter(Boolean).join(' · ');
}
