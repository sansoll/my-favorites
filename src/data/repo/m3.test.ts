import {
  bannerText, formatTime, monthsToMake, notifyText, payDateOf, payDatesWithin, repeatSummary, startLastMonth, DEFAULT_NOTIFY,
} from '../../domain/recurring';
import { notifyDue, askPermissionOnce, type Notifier } from '../../services/notify';
import { freshDb } from '../../test/db';
import type { FavoritesDB } from '../db';
import { deleteTarget } from './edit';
import { addTarget, listCategories, listDetails } from './lists';
import { createBasePresets, listPresets } from './presets';
import { saveRecord } from './records';
import {
  addRecurring, addRecurringFromRecord, deleteRecurring, generateRecurring, getNotify, RecurringError, setNotify,
  setRecurringEnabled, updateRecurring, upcomingPayments,
} from './recurring';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

async function bubble(name = '가수 A') {
  if (!(await listPresets(db)).length) await createBasePresets(db, ['가수용']);
  const t = await addTarget(db, name, (await listPresets(db))[0]);
  const cats = await listCategories(db, t.id);
  const mem = cats.find((c) => c.name === '멤버십')!;
  const dets = await listDetails(db, mem.id);
  return { t, mem, bubble: dets.find((d) => d.name === '버블')!, etc: dets.find((d) => d.isEtc)! };
}

const dates = async () => (await db.records.orderBy('date').toArray()).map((r) => r.date);

describe('정기 결제 규칙 (U3-1 도메인)', () => {
  it('31일 결제는 짧은 달의 마지막 날', () => {
    expect(payDateOf('2026-02', 31)).toBe('2026-02-28');
    expect(payDateOf('2028-02', 31)).toBe('2028-02-29');
    expect(payDateOf('2026-04', 31)).toBe('2026-04-30');
  });
  it('빠진 달 목록은 해를 넘어도 이어짐', () => {
    expect(monthsToMake('2026-11', '2027-02')).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(monthsToMake('2026-11', '2026-11')).toEqual([]);
  });
  it('시작 달: 결제일이 남았으면 이번 달부터, 지났으면 다음 달부터', () => {
    expect(startLastMonth('2026-11-13', 14)).toBe('2026-10');
    expect(startLastMonth('2026-11-13', 13)).toBe('2026-10');
    expect(startLastMonth('2026-11-13', 12)).toBe('2026-11');
    expect(startLastMonth('2026-01-05', 10)).toBe('2025-12');
  });
  it('다가오는 결제일은 다음 달로 넘어가도 찾음', () => {
    expect(payDatesWithin(1, '2026-11-30', 1)).toEqual(['2026-12-01']);
    expect(payDatesWithin(31, '2026-11-29', 2)).toEqual(['2026-11-30']);
    expect(payDatesWithin(14, '2026-11-13', 0)).toEqual([]);
  });
  it('문구', () => {
    expect(notifyText(1, '가수 A', '버블', 4500)).toBe('내일은 가수 A의 버블 4,500원이 나가는 날이에요');
    expect(notifyText(2, '가수 A', '버블', 4500)).toBe('모레는 가수 A의 버블 4,500원이 나가는 날이에요');
    expect(bannerText(1)).toBe('내일 정기 결제가 있어요');
    expect(formatTime('20:00')).toBe('저녁 8시');
    expect(formatTime('09:30')).toBe('오전 9시 30분');
    expect(repeatSummary(13, DEFAULT_NOTIFY)).toBe('매달 13일 · 전날 저녁 8시에 알림');
    expect(repeatSummary(13, { ...DEFAULT_NOTIFY, on: false })).toBe('매달 13일 · 알림 꺼짐');
  });
});

describe('정기 결제 기록 만들기 (U3-1)', () => {
  it('이번 달도 넣기: 결제일이 남았으면 이번 달 예정 기록을 만듦', async () => {
    const { t, mem, bubble: b } = await bubble();
    const r = await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-13');
    const rs = await db.records.toArray();
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ date: '2026-11-14', paid: 4500, recurringId: r.id, detailId: b.id });
  });

  it('이번 달도 넣기: 결제일이 지났어도 이번 달 기록을 만듦', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 10 }, 'thisMonth', '2026-11-13');
    expect(await dates()).toEqual(['2026-11-10']);
  });

  it('다음 달부터: 이번 달은 결제일이 남았어도 만들지 않음', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 20 }, 'nextMonth', '2026-11-13');
    expect(await db.records.count()).toBe(0);
    await generateRecurring(db, '2026-11-30');
    expect(await db.records.count()).toBe(0);
    await generateRecurring(db, '2026-12-01');
    expect(await dates()).toEqual(['2026-12-20']);
  });

  it('몇 달 만에 열어도 빠진 달을 모두 만들고, 같은 달을 두 번 만들지 않음', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 31 }, 'thisMonth', '2026-11-13');
    await generateRecurring(db, '2027-03-02');
    await generateRecurring(db, '2027-03-02');
    await Promise.all([generateRecurring(db, '2027-03-05'), generateRecurring(db, '2027-03-05')]);
    expect(await dates()).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('세부를 비우면 기타', async () => {
    const { t, mem, etc } = await bubble();
    const r = await addRecurring(db, { targetId: t.id, categoryId: mem.id, amount: 1000, day: 20 }, 'thisMonth', '2026-11-13');
    expect(r.detailId).toBe(etc.id);
  });

  it('잘못된 값은 거부', async () => {
    const { t, mem } = await bubble();
    await expect(addRecurring(db, { targetId: t.id, categoryId: mem.id, amount: 0, day: 1 }, 'thisMonth')).rejects.toMatchObject({ reason: 'amount' });
    await expect(addRecurring(db, { targetId: t.id, categoryId: mem.id, amount: 1, day: 32 }, 'thisMonth')).rejects.toMatchObject({ reason: 'day' });
    await expect(addRecurring(db, { targetId: t.id, categoryId: 'x', amount: 1, day: 1 }, 'thisMonth')).rejects.toBeInstanceOf(RecurringError);
  });

  it('꺼진 결제는 안 만들고, 다시 켜면 꺼진 동안의 달은 채우지 않음', async () => {
    const { t, mem, bubble: b } = await bubble();
    const r = await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-13');
    await setRecurringEnabled(db, r.id, false, '2026-11-20');
    await generateRecurring(db, '2027-01-20');
    expect(await dates()).toEqual(['2026-11-14']);
    await setRecurringEnabled(db, r.id, true, '2027-02-10');
    expect(await dates()).toEqual(['2026-11-14', '2027-02-14']);
  });

  it('결제를 지워도 이미 만든 기록은 남음', async () => {
    const { t, mem, bubble: b } = await bubble();
    const r = await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-13');
    await deleteRecurring(db, r.id);
    await generateRecurring(db, '2027-01-20');
    expect(await dates()).toEqual(['2026-11-14']);
  });

  it('금액 화면의 매달 반복: 저장한 기록이 그 달 몫이 되고, 다음 달부터 만듦', async () => {
    const { t, mem, bubble: b } = await bubble();
    const rec = await saveRecord(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, paid: 4500, date: '2026-10-13' });
    const r = await addRecurringFromRecord(db, rec.id, '2026-11-13');
    expect(await db.recurrings.get(r.id)).toMatchObject({ day: 13, amount: 4500, lastMonth: '2026-11' });
    expect((await db.records.get(rec.id))!.recurringId).toBe(r.id);
    expect(await dates()).toEqual(['2026-10-13', '2026-11-13']);
  });

  it('수정하면 다음 기록부터 바뀐 금액', async () => {
    const { t, mem, bubble: b } = await bubble();
    const r = await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-13');
    await updateRecurring(db, r.id, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 5000, day: 15 });
    await generateRecurring(db, '2026-12-01');
    expect((await db.records.orderBy('date').toArray()).map((x) => [x.date, x.paid])).toEqual([['2026-11-14', 4500], ['2026-12-15', 5000]]);
  });

  it('대상을 지우면 정기 결제도 지워짐', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-13');
    await deleteTarget(db, t.id);
    expect(await db.recurrings.count()).toBe(0);
  });
});

describe('다가오는 결제 (U3-2)', () => {
  it('기본은 알림 켜짐, 전날 오후 8시', async () => {
    expect(await getNotify(db)).toEqual({ on: true, when: 'dayBefore', time: '20:00' });
  });

  it('알림 시간 설정에 맞는 결제만, 꺼진 결제는 빼고', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-01');
    const off = await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 100, day: 14 }, 'thisMonth', '2026-11-01');
    await setRecurringEnabled(db, off.id, false);
    expect((await upcomingPayments(db, '2026-11-13')).map((u) => [u.date, u.diff])).toEqual([['2026-11-14', 1]]);
    expect(await upcomingPayments(db, '2026-11-12')).toEqual([]);
    await setNotify(db, { when: 'twoDaysBefore' });
    expect((await upcomingPayments(db, '2026-11-12')).map((u) => u.diff)).toEqual([2]);
    await setNotify(db, { when: 'sameDay' });
    expect((await upcomingPayments(db, '2026-11-14')).map((u) => u.diff)).toEqual([0]);
    expect(await upcomingPayments(db, '2026-11-13')).toEqual([]);
  });

  it('알림을 꺼도 안내용 목록은 그대로', async () => {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-01');
    await setNotify(db, { on: false });
    expect(await upcomingPayments(db, '2026-11-13')).toHaveLength(1);
  });
});

describe('폰 알림 (U3-4)', () => {
  const fake = (perm: NotificationPermission = 'granted') => {
    const shown: string[] = [];
    let p = perm;
    let asked = 0;
    const n: Notifier = {
      permission: () => p,
      request: async () => { asked++; p = 'denied'; return p; },
      show: async (_t, body) => { shown.push(body); },
    };
    return { n, shown, asked: () => asked };
  };

  async function setup() {
    const { t, mem, bubble: b } = await bubble();
    await addRecurring(db, { targetId: t.id, categoryId: mem.id, detailId: b.id, amount: 4500, day: 14 }, 'thisMonth', '2026-11-01');
  }

  it('알림 날 설정 시각이 지나면 대상·세부·금액이 든 알림을 한 번만 보냄', async () => {
    await setup();
    const f = fake();
    expect(await notifyDue(db, new Date(2026, 10, 13, 19, 59), f.n)).toEqual([]);
    expect(await notifyDue(db, new Date(2026, 10, 13, 20, 0), f.n)).toEqual(['내일은 가수 A의 버블 4,500원이 나가는 날이에요']);
    await notifyDue(db, new Date(2026, 10, 13, 21, 0), f.n);
    expect(f.shown).toHaveLength(1);
  });

  it('알림 날을 놓치고 결제일에 열면 그때 보냄', async () => {
    await setup();
    const f = fake();
    expect(await notifyDue(db, new Date(2026, 10, 14, 8, 0), f.n)).toEqual(['오늘은 가수 A의 버블 4,500원이 나가는 날이에요']);
  });

  it('설정에서 알림을 끄거나 권한이 없으면 폰 알림이 안 나감', async () => {
    await setup();
    await setNotify(db, { on: false });
    const f = fake();
    expect(await notifyDue(db, new Date(2026, 10, 13, 21, 0), f.n)).toEqual([]);
    await setNotify(db, { on: true });
    const g = fake('denied');
    expect(await notifyDue(db, new Date(2026, 10, 13, 21, 0), g.n)).toEqual([]);
  });

  it('권한은 처음 한 번만 물음', async () => {
    const f = fake('default');
    await askPermissionOnce(db, f.n);
    await askPermissionOnce(db, { ...f.n, permission: () => 'default' });
    expect(f.asked()).toBe(1);
  });
});
