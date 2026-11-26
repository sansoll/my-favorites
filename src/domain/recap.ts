import type { CheckDay, CheckItem, Place, Song, SongOpen, SpendRecord } from '../data/types';
import { computeStats, computeVisits, rank, type Lists, type RankRow } from './stats';
import { net } from './totals';

/**
 * 연말 결산(U10-1): 카드 8장. 데이터가 없는 카드는 건너뛰고, TOP 3는 같은 값이면 같은 순위(공동)로 셉니다.
 */

export type RecapKind = 'total' | 'months' | 'targets' | 'categories' | 'places' | 'checks' | 'cheerMonths' | 'songs';

export interface RecapRow { name: string; value: number; rank: number }

export interface RecapCard {
  kind: RecapKind;
  /** 1위(총액 카드는 총액) */
  top: RecapRow;
  /** 2·3위(공동 순위 포함) */
  rest: RecapRow[];
  /** 총액 카드: 한 달 평균 */
  average?: number;
}

export interface RecapInput {
  year: number;
  records: SpendRecord[];
  lists: Lists;
  places: Map<string, Place>;
  checkItems: CheckItem[];
  checkDays: CheckDay[];
  songs: Song[];
  songOpens: SongOpen[];
}

/** 순위가 3 이하인 줄(공동 순위로 3개가 넘을 수 있음, 최대 5줄) */
export function top3(rows: RankRow[]): RecapRow[] {
  return rows.filter((r) => r.rank <= 3).slice(0, 5).map((r) => ({ name: r.name, value: r.amount, rank: r.rank }));
}

function card(kind: RecapKind, rows: RankRow[]): RecapCard | null {
  const t = top3(rows);
  if (!t.length) return null;
  return { kind, top: t[0], rest: t.slice(1) };
}

const monthOfDate = (d: string) => Number(d.slice(5, 7));
const yearOfMs = (ms: number) => new Date(ms).getFullYear();
const monthOfMs = (ms: number) => new Date(ms).getMonth() + 1;

export function computeRecap(input: RecapInput): RecapCard[] {
  const { year } = input;
  const prefix = `${year}-`;
  const recs = input.records.filter((r) => r.date.startsWith(prefix));
  const st = computeStats(recs, input.lists, { mode: 'year', y: year, m: 1 });
  const out: (RecapCard | null)[] = [];

  // 1 올해 총액, 한 달 평균(기록이 있는 해의 12달로 나눔)
  out.push(st.total > 0 ? { kind: 'total', top: { name: `${year}년`, value: st.total, rank: 1 }, rest: [], average: Math.round(st.total / 12) } : null);

  // 2 많이 쓴 달
  const months = new Map<number, number>();
  for (const r of recs) months.set(monthOfDate(r.date), (months.get(monthOfDate(r.date)) ?? 0) + net(r));
  out.push(card('months', rank([...months.entries()].map(([m, v]) => ({ key: String(m), name: `${m}월`, amount: v })))));

  // 3·4 대상, 분류
  out.push(card('targets', st.targets));
  out.push(card('categories', st.categories));

  // 5 가장 많이 간 곳(같은 날 같은 곳은 1번)
  const visits = computeVisits(recs, input.places, year, 'count');
  out.push(card('places', rank(visits.map((v) => ({ key: v.place.id, name: v.place.displayName || v.place.name, amount: v.count })))));

  // 6 가장 많이 체크한 항목(지운 날 제외)
  const itemName = new Map(input.checkItems.map((c) => [c.id, `${input.lists.targets.get(c.targetId)?.name ?? ''} · ${c.name}`]));
  const days = new Map<string, Set<string>>();
  for (const d of input.checkDays) {
    if (d.dismissed || !d.date.startsWith(prefix) || !itemName.has(d.itemId)) continue;
    const s = days.get(d.itemId) ?? new Set<string>();
    s.add(d.date);
    days.set(d.itemId, s);
  }
  out.push(card('checks', rank([...days.entries()].map(([id, s]) => ({ key: id, name: itemName.get(id)!, amount: s.size })))));

  // 7·8 응원법 펼친 달, 많이 펼친 곡
  const opens = input.songOpens.filter((o) => yearOfMs(o.at) === year);
  const om = new Map<number, number>();
  for (const o of opens) om.set(monthOfMs(o.at), (om.get(monthOfMs(o.at)) ?? 0) + 1);
  out.push(card('cheerMonths', rank([...om.entries()].map(([m, v]) => ({ key: String(m), name: `${m}월`, amount: v })))));
  const songName = new Map(input.songs.map((s) => [s.id, `${input.lists.targets.get(s.targetId)?.name ?? ''} · ${s.title}`]));
  const os = new Map<string, number>();
  for (const o of opens) if (songName.has(o.songId)) os.set(o.songId, (os.get(o.songId) ?? 0) + 1);
  out.push(card('songs', rank([...os.entries()].map(([id, v]) => ({ key: id, name: songName.get(id)!, amount: v })))));

  return out.filter((c): c is RecapCard => c !== null);
}

/** 기록·체크·펼친 곡이 하나라도 있는 연도(최근 순) */
export function recapYears(records: SpendRecord[], checkDays: CheckDay[], songOpens: SongOpen[]): number[] {
  const ys = new Set<number>();
  for (const r of records) if (net(r) > 0) ys.add(Number(r.date.slice(0, 4)));
  for (const d of checkDays) if (!d.dismissed) ys.add(Number(d.date.slice(0, 4)));
  for (const o of songOpens) ys.add(yearOfMs(o.at));
  return [...ys].sort((a, b) => b - a);
}

/**
 * 새해 첫 실행 판단(U10-2): 올해 들어 처음 연 것이고(지난해 결산을 아직 안 봤고) 지난해 데이터가 있으면 지난해를 돌려줍니다.
 * 한 번 보면(또는 데이터가 없어 건너뛰면) 그해에는 다시 묻지 않습니다.
 */
export function newYearRecap(thisYear: number, lastShownYear: number | null, years: number[]): number | null {
  const prev = thisYear - 1;
  if (lastShownYear !== null && lastShownYear >= prev) return null;
  return years.includes(prev) ? prev : null;
}
