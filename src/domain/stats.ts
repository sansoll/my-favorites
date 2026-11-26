import type { Category, Detail, Place, SpendRecord, Target } from '../data/types';
import { addMonths, inRange, monthRange, yearRange, type DateStr } from './date';
import { nameKey } from './name';
import { net } from './totals';

export type StatsMode = 'month' | 'year';

export interface Period { mode: StatsMode; y: number; m: number }

export function periodRange(p: Period): { start: DateStr; end: DateStr } {
  return p.mode === 'month' ? monthRange(p.y, p.m) : yearRange(p.y);
}

export function shiftPeriod(p: Period, delta: number): Period {
  if (p.mode === 'year') return { ...p, y: p.y + delta };
  const n = addMonths(p.y, p.m, delta);
  return { ...p, y: n.y, m: n.m };
}

/** 이번 기간에서 멈춤: 오늘이 속한 기간보다 뒤로는 못 감 */
export function isCurrentPeriod(p: Period, today: DateStr): boolean {
  const [y, m] = today.split('-').map(Number);
  return p.mode === 'year' ? p.y >= y : p.y > y || (p.y === y && p.m >= m);
}

export function periodLabel(p: Period): string {
  return p.mode === 'month' ? `${p.y}년 ${p.m}월` : `${p.y}년`;
}

export interface RankRow { key: string; name: string; amount: number; rank: number; color?: string }

/** 같은 금액은 같은 순위(1, 1, 3). 0원 이하는 뺍니다. */
export function rank(rows: Omit<RankRow, 'rank'>[]): RankRow[] {
  const sorted = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ko'));
  const out: RankRow[] = [];
  sorted.forEach((r, i) => {
    const prev = out[i - 1];
    out.push({ ...r, rank: prev && prev.amount === r.amount ? prev.rank : i + 1 });
  });
  return out;
}

export interface Lists { targets: Map<string, Target>; categories: Map<string, Category>; details: Map<string, Detail> }

export interface Stats {
  total: number;
  prevTotal: number;
  count: number;
  targets: RankRow[];
  categories: RankRow[];
  details: RankRow[];
}

/**
 * 통계 계산(U6-1): 결제 − 환불, 대상·분류·세부 랭킹.
 * 분류·세부는 대상이 달라도 이름이 같으면(공백 무시) 합칩니다. 세부 `기타`는 분류마다 따로(`행사 · 기타`).
 */
export function computeStats(records: SpendRecord[], l: Lists, p: Period): Stats {
  const r = periodRange(p);
  const pr = periodRange(shiftPeriod(p, -1));
  const inP = records.filter((x) => inRange(x.date, r));
  const prevTotal = records.filter((x) => inRange(x.date, pr)).reduce((s, x) => s + net(x), 0);
  const bump = (m: Map<string, Omit<RankRow, 'rank'>>, key: string, name: string, v: number, color?: string) => {
    const cur = m.get(key);
    if (cur) cur.amount += v;
    else m.set(key, { key, name, amount: v, color });
  };
  const t = new Map<string, Omit<RankRow, 'rank'>>();
  const c = new Map<string, Omit<RankRow, 'rank'>>();
  const d = new Map<string, Omit<RankRow, 'rank'>>();
  let total = 0;
  for (const x of inP) {
    const v = net(x);
    total += v;
    const tg = l.targets.get(x.targetId);
    const cg = l.categories.get(x.categoryId);
    const dt = l.details.get(x.detailId);
    bump(t, x.targetId, tg?.name ?? '(지운 대상)', v, tg?.color);
    const cName = cg?.name ?? '기타';
    bump(c, nameKey(cName), cName, v);
    const dName = dt && !dt.isEtc ? dt.name : `${cName} · 기타`;
    bump(d, nameKey(dName), dName, v);
  }
  return { total, prevTotal, count: inP.length, targets: rank([...t.values()]), categories: rank([...c.values()]), details: rank([...d.values()]) };
}

// ── 다녀온 곳(U6-3) ─────────────────────────────

export type VisitSort = 'count' | 'recent' | 'spend';

export interface Visit {
  place: Place;
  /** 같은 날 같은 장소는 1번 */
  count: number;
  spend: number;
  last: DateStr;
  targetIds: string[];
  records: SpendRecord[];
}

export function computeVisits(records: SpendRecord[], places: Map<string, Place>, year: number | null, sort: VisitSort): Visit[] {
  const by = new Map<string, SpendRecord[]>();
  for (const r of records) {
    if (!r.placeId || !places.has(r.placeId)) continue;
    if (year !== null && !r.date.startsWith(`${year}-`)) continue;
    const a = by.get(r.placeId) ?? [];
    a.push(r);
    by.set(r.placeId, a);
  }
  const out: Visit[] = [...by.entries()].map(([id, rs]) => {
    const sorted = rs.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
    return {
      place: places.get(id)!,
      count: new Set(rs.map((x) => x.date)).size,
      spend: rs.reduce((s, x) => s + net(x), 0),
      last: sorted[0].date,
      targetIds: [...new Set(sorted.map((x) => x.targetId))],
      records: sorted,
    };
  });
  const byLast = (a: Visit, b: Visit) => (a.last === b.last ? 0 : a.last < b.last ? 1 : -1);
  const cmp: Record<VisitSort, (a: Visit, b: Visit) => number> = {
    count: (a, b) => b.count - a.count || byLast(a, b),
    recent: (a, b) => byLast(a, b) || b.count - a.count,
    spend: (a, b) => b.spend - a.spend || b.count - a.count,
  };
  return out.sort(cmp[sort]);
}
