import { monthOf, parseDateStr, today, type DateStr } from '../../domain/date';
import { isValidAmount } from '../../domain/money';
import {
  DEFAULT_NOTIFY, LEAD_DAYS, daysBetween, monthsToMake, payDateOf, payDatesWithin, prevMonth, startLastMonth, type NotifySettings,
} from '../../domain/recurring';
import { newId, type FavoritesDB } from '../db';
import { getSetting, setSetting } from '../settings';
import type { Recurring, SpendRecord } from '../types';

export class RecurringError extends Error {
  constructor(public reason: 'amount' | 'day' | 'list' | 'notFound') {
    super(reason);
  }
}

export const NOTIFY_KEY = 'notify';

export async function getNotify(db: FavoritesDB): Promise<NotifySettings> {
  return { ...DEFAULT_NOTIFY, ...(await getSetting<Partial<NotifySettings>>(db, NOTIFY_KEY, {})) };
}

export async function setNotify(db: FavoritesDB, patch: Partial<NotifySettings>): Promise<void> {
  await setSetting(db, NOTIFY_KEY, { ...(await getNotify(db)), ...patch });
}

export interface RecurringInput {
  targetId: string;
  categoryId: string;
  /** 비우면 그 분류의 `기타` */
  detailId?: string;
  amount: number;
  day: number;
}

/** 처음 만들 때 이번 달 몫도 만들지(thisMonth), 다음 달부터 만들지(nextMonth) */
export type RecurringStart = 'thisMonth' | 'nextMonth';

function checkDay(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RecurringError('day');
}

async function resolveList(db: FavoritesDB, input: { targetId: string; categoryId: string; detailId?: string }) {
  const [t, c] = await Promise.all([db.targets.get(input.targetId), db.categories.get(input.categoryId)]);
  if (!t || !c || c.targetId !== t.id) throw new RecurringError('list');
  const d = input.detailId
    ? await db.details.get(input.detailId)
    : (await db.details.where('categoryId').equals(c.id).toArray()).find((x) => x.isEtc);
  if (!d || d.categoryId !== c.id) throw new RecurringError('list');
  return { targetId: t.id, categoryId: c.id, detailId: d.id };
}

/**
 * 정기 결제 화면에서 추가. 추가할 때 사용자에게 이번 달도 넣을지 묻습니다.
 * `thisMonth`면 이번 달 결제일 기록(지났으면 지난 날짜, 남았으면 예정)을 바로 만들고, `nextMonth`면 다음 달부터 만듭니다.
 */
export async function addRecurring(db: FavoritesDB, input: RecurringInput, start: RecurringStart, todayStr: DateStr = today()): Promise<Recurring> {
  if (!isValidAmount(input.amount)) throw new RecurringError('amount');
  checkDay(input.day);
  const r = await db.transaction('rw', db.recurrings, db.targets, db.categories, db.details, async () => {
    const list = await resolveList(db, input);
    const rec: Recurring = { id: newId(), ...list, amount: input.amount, day: input.day, enabled: true, lastMonth: start === 'thisMonth' ? prevMonth(monthOf(todayStr)) : monthOf(todayStr) };
    await db.recurrings.add(rec);
    return rec;
  });
  await generateRecurring(db, todayStr);
  return r;
}

/** 금액 화면에서 `매달 반복`을 켜고 저장: 방금 저장한 기록이 그 달 몫입니다. */
export async function addRecurringFromRecord(db: FavoritesDB, recordId: string, todayStr: DateStr = today()): Promise<Recurring> {
  const r = await db.transaction('rw', db.recurrings, db.records, async () => {
    const rec = await db.records.get(recordId);
    if (!rec) throw new RecurringError('notFound');
    const x: Recurring = {
      id: newId(), targetId: rec.targetId, categoryId: rec.categoryId, detailId: rec.detailId,
      amount: rec.paid, day: parseDateStr(rec.date).d, enabled: true, lastMonth: monthOf(rec.date),
    };
    await db.recurrings.add(x);
    await db.records.update(rec.id, { recurringId: x.id });
    return x;
  });
  await generateRecurring(db, todayStr);
  return r;
}

export async function updateRecurring(db: FavoritesDB, id: string, input: RecurringInput): Promise<void> {
  if (!isValidAmount(input.amount)) throw new RecurringError('amount');
  checkDay(input.day);
  await db.transaction('rw', db.recurrings, db.targets, db.categories, db.details, async () => {
    if (!(await db.recurrings.get(id))) throw new RecurringError('notFound');
    const list = await resolveList(db, input);
    await db.recurrings.update(id, { ...list, amount: input.amount, day: input.day });
  });
}

/** 끄면 그동안은 기록을 만들지 않고, 다시 켜면 그때부터 만듭니다(꺼진 동안의 달은 채우지 않음). */
export async function setRecurringEnabled(db: FavoritesDB, id: string, enabled: boolean, todayStr: DateStr = today()): Promise<void> {
  await db.transaction('rw', db.recurrings, async () => {
    const r = await db.recurrings.get(id);
    if (!r) throw new RecurringError('notFound');
    const start = startLastMonth(todayStr, r.day);
    await db.recurrings.update(id, enabled ? { enabled, lastMonth: r.lastMonth > start ? r.lastMonth : start } : { enabled });
  });
  if (enabled) await generateRecurring(db, todayStr);
}

/** 정기 결제를 지워도 이미 만든 기록은 남습니다. */
export async function deleteRecurring(db: FavoritesDB, id: string): Promise<void> {
  await db.recurrings.delete(id);
}

export async function listRecurrings(db: FavoritesDB): Promise<Recurring[]> {
  const [rs, targets] = await Promise.all([db.recurrings.toArray(), db.targets.toArray()]);
  const order = new Map(targets.map((t) => [t.id, t.order]));
  return rs.sort((a, b) => a.day - b.day || (order.get(a.targetId) ?? 0) - (order.get(b.targetId) ?? 0));
}

/**
 * 앱을 열 때 부릅니다(U3-1). 켜진 정기 결제마다 마지막으로 만든 달 다음부터 이번 달까지 기록을 만듭니다.
 * 결제일이 아직이면 예정(미래 날짜) 기록이 됩니다. 한 트랜잭션 안에서 lastMonth를 함께 올려 같은 달을 두 번 만들지 않습니다.
 */
export async function generateRecurring(db: FavoritesDB, todayStr: DateStr = today(), now: number = Date.now()): Promise<SpendRecord[]> {
  const until = monthOf(todayStr);
  return db.transaction('rw', db.recurrings, db.records, db.details, async () => {
    const made: SpendRecord[] = [];
    for (const r of await db.recurrings.toArray()) {
      if (!r.enabled) continue;
      const months = monthsToMake(r.lastMonth, until);
      if (!months.length) continue;
      const detail = await db.details.get(r.detailId);
      if (!detail) continue;
      for (const m of months) {
        const rec: SpendRecord = {
          id: newId(), date: payDateOf(m, r.day), targetId: r.targetId, categoryId: r.categoryId, detailId: r.detailId,
          etcText: '', paid: r.amount, refund: 0, memo: '', recurringId: r.id, createdAt: now, updatedAt: now,
        };
        await db.records.add(rec);
        made.push(rec);
      }
      await db.recurrings.update(r.id, { lastMonth: months[months.length - 1] });
    }
    return made;
  });
}

export interface Upcoming {
  recurring: Recurring;
  date: DateStr;
  /** 오늘부터 며칠 뒤(0 = 오늘) */
  diff: number;
}

/** 알림 시간 설정 안에 드는 다가오는 결제(가까운 순). 알림을 꺼도 기록 탭 안내에는 씁니다. */
export async function upcomingPayments(db: FavoritesDB, todayStr: DateStr = today()): Promise<Upcoming[]> {
  const n = await getNotify(db);
  const lead = LEAD_DAYS[n.when];
  const out: Upcoming[] = [];
  for (const r of await db.recurrings.toArray()) {
    if (!r.enabled) continue;
    for (const d of payDatesWithin(r.day, todayStr, lead)) out.push({ recurring: r, date: d, diff: daysBetween(todayStr, d) });
  }
  return out.sort((a, b) => a.diff - b.diff);
}
