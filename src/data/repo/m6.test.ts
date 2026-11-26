import { computeStats, computeVisits, isCurrentPeriod, rank, shiftPeriod, type Lists } from '../../domain/stats';
import type { Category, Detail, Place, SpendRecord, Target } from '../types';
import { freshDb } from '../../test/db';
import { namePlace, renamePlace, searchPlace } from './places';

const T = (id: string, name: string): Target => ({ id, name, color: '#000', order: 0, isEtc: false });
const C = (id: string, targetId: string, name: string, isEtc = false): Category => ({ id, targetId, name, order: 0, isEtc });
const D = (id: string, categoryId: string, name: string, isEtc = false): Detail => ({ id, categoryId, name, order: 0, isEtc });
let n = 0;
const R = (o: Partial<SpendRecord>): SpendRecord => ({ id: `r${++n}`, date: '2026-11-13', targetId: 'a', categoryId: 'ca', detailId: 'da', etcText: '', paid: 0, refund: 0, memo: '', createdAt: n, updatedAt: 0, ...o });

const lists: Lists = {
  targets: new Map([['a', T('a', '가수 A')], ['b', T('b', '가수 B')]]),
  categories: new Map([['ca', C('ca', 'a', '행사')], ['cb', C('cb', 'b', ' 행 사')], ['cae', C('cae', 'a', '기타', true)]]),
  details: new Map([['da', D('da', 'ca', '콘서트')], ['db', D('db', 'cb', '콘 서트')], ['dae', D('dae', 'ca', '기타', true)], ['dce', D('dce', 'cae', '기타', true)]]),
};

describe('통계 계산 (U6-1)', () => {
  const recs = [
    R({ paid: 154000, refund: 30000 }),
    R({ targetId: 'b', categoryId: 'cb', detailId: 'db', paid: 100000 }),
    R({ detailId: 'dae', paid: 24000 }),
    R({ date: '2026-10-02', paid: 50000 }),
    R({ date: '2025-11-02', paid: 7000 }),
  ];

  it('월 합계·이전 기간, 환불 반영, 공백만 다른 이름은 합침', () => {
    const s = computeStats(recs, lists, { mode: 'month', y: 2026, m: 11 });
    expect(s.total).toBe(124000 + 100000 + 24000);
    expect(s.prevTotal).toBe(50000);
    expect(s.targets.map((r) => [r.name, r.amount, r.rank])).toEqual([['가수 A', 148000, 1], ['가수 B', 100000, 2]]);
    expect(s.categories.map((r) => [r.name, r.amount])).toEqual([['행사', 248000]]);
    expect(s.details.map((r) => [r.name, r.amount])).toEqual([['콘서트', 224000], ['행사 · 기타', 24000]]);
  });

  it('연 합계와 작년', () => {
    const s = computeStats(recs, lists, { mode: 'year', y: 2026, m: 1 });
    expect(s.total).toBe(298000);
    expect(s.prevTotal).toBe(7000);
  });

  it('같은 금액은 같은 순위', () => {
    expect(rank([{ key: 'x', name: 'x', amount: 5 }, { key: 'y', name: 'y', amount: 5 }, { key: 'z', name: 'z', amount: 3 }, { key: 'w', name: 'w', amount: 0 }]).map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('기록이 없으면 빈 상태', () => {
    const s = computeStats([], lists, { mode: 'month', y: 2026, m: 11 });
    expect(s).toMatchObject({ total: 0, count: 0, targets: [], categories: [], details: [] });
  });

  it('기간 이동은 이번 기간에서 멈춤', () => {
    expect(shiftPeriod({ mode: 'month', y: 2026, m: 1 }, -1)).toEqual({ mode: 'month', y: 2025, m: 12 });
    expect(isCurrentPeriod({ mode: 'month', y: 2026, m: 11 }, '2026-11-26')).toBe(true);
    expect(isCurrentPeriod({ mode: 'month', y: 2026, m: 10 }, '2026-11-26')).toBe(false);
    expect(isCurrentPeriod({ mode: 'year', y: 2026, m: 1 }, '2026-11-26')).toBe(true);
  });
});

describe('다녀온 곳 계산 (U6-3)', () => {
  const P = (id: string, name: string): Place => ({ id, source: 'name', externalId: '', name });
  const places = new Map([['k', P('k', 'KSPO')], ['o', P('o', '올림픽홀')], ['t', P('t', 'Tokyo Dome')]]);
  const recs = [
    R({ placeId: 'k', date: '2026-11-13', paid: 124000 }),
    R({ placeId: 'k', date: '2026-11-13', paid: 30000 }), // 같은 날 = 1번
    R({ placeId: 'k', date: '2026-05-01', paid: 99000, targetId: 'b' }),
    R({ placeId: 'o', date: '2026-11-20', paid: 10000 }),
    R({ placeId: 'o', date: '2026-08-20', paid: 10000 }),
    R({ placeId: 't', date: '2025-12-01', paid: 500000 }),
    R({ date: '2026-11-01', paid: 1 }),
  ];

  it('같은 날 같은 장소는 1번, 쓴 돈·마지막·함께한 대상', () => {
    const v = computeVisits(recs, places, 2026, 'count');
    expect(v.map((x) => [x.place.name, x.count])).toEqual([['올림픽홀', 2], ['KSPO', 2]]);
    const k = v.find((x) => x.place.id === 'k')!;
    expect(k).toMatchObject({ spend: 253000, last: '2026-11-13', targetIds: ['a', 'b'] });
  });

  it('최근 순·많이 쓴 순, 올해·전체', () => {
    expect(computeVisits(recs, places, 2026, 'recent').map((x) => x.place.id)).toEqual(['o', 'k']);
    expect(computeVisits(recs, places, null, 'spend').map((x) => x.place.id)).toEqual(['t', 'k', 'o']);
  });
});

describe('보이는 이름 바꾸기 (U6-4)', () => {
  it('검색 장소는 보이는 이름만, 비우면 원래대로. 이름만 장소는 이름 자체', async () => {
    const db = freshDb();
    const p = await searchPlace(db, { source: 'kakao', externalId: '8', name: 'KSPO DOME' });
    await renamePlace(db, p.id, '체조경기장');
    expect(await db.places.get(p.id)).toMatchObject({ name: 'KSPO DOME', displayName: '체조경기장' });
    await renamePlace(db, p.id, '');
    expect((await db.places.get(p.id))!.displayName).toBeUndefined();
    const np = await namePlace(db, '성수 팝업');
    await renamePlace(db, np.id, '성수 팝업스토어');
    expect((await db.places.get(np.id))!.name).toBe('성수 팝업스토어');
  });
});
