import type { Category, CheckDay, Detail, Place, SpendRecord, Target } from '../data/types';
import { computeRecap, newYearRecap, recapYears, top3 } from './recap';
import type { Lists } from './stats';

const T = (id: string, name: string): Target => ({ id, name, color: '#000', order: 0, isEtc: false });
const C = (id: string, targetId: string, name: string): Category => ({ id, targetId, name, order: 0, isEtc: false });
const D = (id: string, categoryId: string, name: string, isEtc = false): Detail => ({ id, categoryId, name, order: 0, isEtc });
let n = 0;
const R = (o: Partial<SpendRecord>): SpendRecord => ({ id: `r${++n}`, date: '2026-05-01', targetId: 'a', categoryId: 'ca', detailId: 'da', etcText: '', paid: 0, refund: 0, memo: '', createdAt: n, updatedAt: 0, ...o });
const lists: Lists = {
  targets: new Map([['a', T('a', '가수 A')], ['b', T('b', '가수 B')], ['c', T('c', '가수 C')]]),
  categories: new Map([['ca', C('ca', 'a', '행사')], ['cb', C('cb', 'b', '상품')], ['cc', C('cc', 'c', '경비')]]),
  details: new Map([['da', D('da', 'ca', '콘서트')], ['db', D('db', 'cb', '앨범')], ['dc', D('dc', 'cc', '교통')]]),
};
const place = (id: string, name: string): Place => ({ id, source: 'name', externalId: '', name });
const at = (y: number, m: number, d = 1) => new Date(y, m - 1, d, 12).getTime();

describe('결산 계산 (U10-1)', () => {
  const base = {
    year: 2026,
    lists,
    places: new Map([['p1', place('p1', 'KSPO DOME')], ['p2', place('p2', '올림픽홀')]]),
    checkItems: [{ id: 'i1', targetId: 'a', name: '버블', on: true, order: 0 }],
    songs: [{ id: 's1', targetId: 'a', title: '곡 1', lyrics: '', layer: { marks: [], extras: [] }, links: [], createdAt: 0 }],
  };

  it('카드 8장: 총액·평균, 달, 대상, 분류, 장소, 체크, 응원법 달, 곡', () => {
    const records = [
      R({ date: '2026-05-01', paid: 120000, placeId: 'p1' }),
      R({ date: '2026-05-01', paid: 10000, placeId: 'p1' }),
      R({ date: '2026-09-03', targetId: 'b', categoryId: 'cb', detailId: 'db', paid: 50000, placeId: 'p2' }),
      R({ date: '2026-12-24', targetId: 'c', categoryId: 'cc', detailId: 'dc', paid: 30000, refund: 10000, placeId: 'p1' }),
      R({ date: '2025-12-31', paid: 999999 }),
    ];
    const checkDays: CheckDay[] = [
      { id: 'd1', itemId: 'i1', date: '2026-01-01', source: 'manual' },
      { id: 'd2', itemId: 'i1', date: '2026-01-02', source: 'manual' },
      { id: 'd3', itemId: 'i1', date: '2026-01-03', source: 'auto', dismissed: true },
    ];
    const songOpens = [{ id: 'o1', songId: 's1', at: at(2026, 8) }, { id: 'o2', songId: 's1', at: at(2026, 8, 2) }, { id: 'o3', songId: 's1', at: at(2025, 8) }];
    const cards = computeRecap({ ...base, records, checkDays, songOpens });
    expect(cards.map((c) => c.kind)).toEqual(['total', 'months', 'targets', 'categories', 'places', 'checks', 'cheerMonths', 'songs']);
    expect(cards[0]).toMatchObject({ top: { value: 200000 }, average: 16667 });
    expect(cards[1].top).toMatchObject({ name: '5월', value: 130000 });
    expect(cards[1].rest.map((r) => r.name)).toEqual(['9월', '12월']);
    expect(cards[2].top).toMatchObject({ name: '가수 A', value: 130000 });
    expect(cards[4].top).toMatchObject({ name: 'KSPO DOME', value: 2 });
    expect(cards[5].top).toMatchObject({ name: '가수 A · 버블', value: 2 });
    expect(cards[6].top).toMatchObject({ name: '8월', value: 2 });
    expect(cards[7].top).toMatchObject({ name: '가수 A · 곡 1', value: 2 });
  });

  it('빈 카드는 건너뜀, 연도 범위 밖은 안 셈', () => {
    const cards = computeRecap({ ...base, records: [R({ date: '2026-03-03', paid: 1000 })], checkDays: [], songOpens: [{ id: 'o', songId: 's1', at: at(2027, 1) }] });
    expect(cards.map((c) => c.kind)).toEqual(['total', 'months', 'targets', 'categories']);
    expect(computeRecap({ ...base, records: [], checkDays: [], songOpens: [] })).toEqual([]);
  });

  it('TOP 3 공동 순위: 같은 값은 같은 순위, 3위 공동이면 모두', () => {
    expect(top3([
      { key: 'a', name: 'A', amount: 5, rank: 1 }, { key: 'b', name: 'B', amount: 5, rank: 1 },
      { key: 'c', name: 'C', amount: 3, rank: 3 }, { key: 'd', name: 'D', amount: 3, rank: 3 }, { key: 'e', name: 'E', amount: 1, rank: 5 },
    ]).map((r) => [r.name, r.rank])).toEqual([['A', 1], ['B', 1], ['C', 3], ['D', 3]]);
  });

  it('결산 볼 수 있는 연도', () => {
    expect(recapYears([R({ date: '2025-01-01', paid: 1 }), R({ date: '2026-01-01', paid: 1 })], [], [{ id: 'o', songId: 's', at: at(2024, 3) }])).toEqual([2026, 2025, 2024]);
  });
});

describe('새해 첫 실행 판단 (U10-2)', () => {
  it('그해 첫 실행에 지난해 데이터가 있으면 한 번만', () => {
    expect(newYearRecap(2027, null, [2026])).toBe(2026);
    expect(newYearRecap(2027, 2026, [2026])).toBeNull();
    expect(newYearRecap(2027, 2025, [2026, 2025])).toBe(2026);
    expect(newYearRecap(2027, null, [2025])).toBeNull();
    expect(newYearRecap(2027, null, [])).toBeNull();
  });
});
