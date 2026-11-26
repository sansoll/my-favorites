import { checkCounts, coverFit, coverFor, monthGrid } from '../../domain/check';
import { fitWithin } from '../../services/photo';
import { freshDb } from '../../test/db';
import type { FavoritesDB } from '../db';
import {
  addCheckItem, CheckError, checkedDates, checkedOn, listCheckItems, setCheckItemOn, setCover, setCoverWindow, toggleCheck,
} from './checks';
import { deleteTarget } from './edit';
import { addTarget } from './lists';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

describe('체크 항목과 체크한 날 (U4-1)', () => {
  it('대상 + 이름으로 만들고, 같은 대상에 공백만 다른 같은 이름은 거부', async () => {
    const a = await addTarget(db, '가수 A');
    const b = await addTarget(db, '가수 B');
    await addCheckItem(db, a.id, '위버스 DM');
    await expect(addCheckItem(db, a.id, '위버스DM')).rejects.toMatchObject({ reason: 'duplicate' });
    await expect(addCheckItem(db, a.id, '  ')).rejects.toMatchObject({ reason: 'empty' });
    await addCheckItem(db, a.id, '버블');
    await addCheckItem(db, b.id, '위버스 DM');
    expect((await listCheckItems(db)).map((x) => x.name)).toEqual(['위버스 DM', '버블', '위버스 DM']);
  });

  it('켜기·끄기: 켠 항목만 목록에', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    await addCheckItem(db, a.id, '라이브');
    await setCheckItemOn(db, x.id, false);
    expect((await listCheckItems(db, true)).map((i) => i.name)).toEqual(['라이브']);
  });

  it('체크·해제, 미래 날짜는 체크 안 됨, 직접 체크는 횟수 없이', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    expect(await toggleCheck(db, x.id, '2026-11-13', '2026-11-13')).toBe(true);
    const row = (await db.checkDays.toArray())[0];
    expect(row).toMatchObject({ source: 'manual', date: '2026-11-13' });
    expect(row.count).toBeUndefined();
    expect(await toggleCheck(db, x.id, '2026-11-13', '2026-11-13')).toBe(false);
    expect(await db.checkDays.count()).toBe(0);
    await expect(toggleCheck(db, x.id, '2026-11-14', '2026-11-13')).rejects.toBeInstanceOf(CheckError);
  });

  it('자동으로 들어온 날을 지우면 dismissed로 남기고, 다시 누르면 체크', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    await db.checkDays.add({ id: 'auto1', itemId: x.id, date: '2026-11-10', count: 3, source: 'auto' });
    expect(await toggleCheck(db, x.id, '2026-11-10', '2026-11-13')).toBe(false);
    expect((await db.checkDays.get('auto1'))!.dismissed).toBe(true);
    expect((await checkedDates(db, x.id)).has('2026-11-10')).toBe(false);
    expect(await toggleCheck(db, x.id, '2026-11-10', '2026-11-13')).toBe(true);
    expect((await checkedDates(db, x.id)).has('2026-11-10')).toBe(true);
  });

  it('오늘 체크 여부', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    const y = await addCheckItem(db, a.id, '라이브');
    await toggleCheck(db, x.id, '2026-11-13', '2026-11-13');
    expect([...(await checkedOn(db, [x.id, y.id], '2026-11-13'))]).toEqual([x.id]);
  });

  it('대상을 지우면 그 항목과 체크한 날도 삭제', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    await toggleCheck(db, x.id, '2026-11-13', '2026-11-13');
    await deleteTarget(db, a.id);
    expect(await db.checkItems.count()).toBe(0);
    expect(await db.checkDays.count()).toBe(0);
  });
});

describe('체크 집계 (U4-2)', () => {
  it('이번 달·지난달·올해, 해제하면 바로 줄어듦', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    for (const d of ['2026-11-01', '2026-11-02', '2026-10-31', '2026-01-05', '2025-12-31']) await toggleCheck(db, x.id, d, '2026-11-13');
    expect(checkCounts(await checkedDates(db, x.id), '2026-11')).toEqual({ month: 2, prevMonth: 1, year: 4 });
    await toggleCheck(db, x.id, '2026-11-02', '2026-11-13');
    expect(checkCounts(await checkedDates(db, x.id), '2026-11')).toEqual({ month: 1, prevMonth: 1, year: 3 });
    expect(checkCounts(await checkedDates(db, x.id), '2026-01')).toEqual({ month: 1, prevMonth: 1, year: 3 });
  });
});

describe('달력 표지 (U4-4)', () => {
  it('모든 달과 이번 달만, 처음 넣으면 사진 창문 보기', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    await setCover(db, x.id, 'p1', 'all', '2026-11');
    await setCover(db, x.id, 'p2', 'month', '2026-10');
    const it = (await db.checkItems.get(x.id))!;
    expect(it.cover!.bg).toBe(true);
    expect(coverFor(it.cover, '2026-11')).toBe('p1');
    expect(coverFor(it.cover, '2026-10')).toBe('p2');
    await setCover(db, x.id, null, 'month', '2026-09');
    expect(coverFor((await db.checkItems.get(x.id))!.cover, '2026-09')).toBeNull();
    await setCoverWindow(db, x.id, false);
    await setCover(db, x.id, null, 'all', '2026-11');
    const after = (await db.checkItems.get(x.id))!.cover!;
    expect(after).toEqual({ all: null, months: {}, bg: false });
    expect(coverFor(undefined, '2026-11')).toBeNull();
  });

  it('사진은 긴 변 900px로 줄임', () => {
    expect(fitWithin(3000, 2000)).toEqual({ w: 900, h: 600 });
    expect(fitWithin(1000, 4000)).toEqual({ w: 225, h: 900 });
    expect(fitWithin(400, 300)).toEqual({ w: 400, h: 300 });
  });

  it('창문 계산: 사진을 달력에 cover로 깔고 가운데 맞춤', () => {
    expect(coverFit({ w: 800, h: 520 }, { w: 350, h: 350 })).toEqual({ w: 350 * 800 / 520, h: 350, x: (350 - 350 * 800 / 520) / 2, y: 0 });
  });

  it('달력 칸: 일요일 시작, 7의 배수', () => {
    const g = monthGrid('2026-11');
    expect(g[0]).toBe('2026-11-01'); // 2026-11-01은 일요일
    expect(g.length % 7).toBe(0);
    expect(monthGrid('2026-10').indexOf('2026-10-01')).toBe(4); // 목요일
  });
});
