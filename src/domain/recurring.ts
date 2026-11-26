import { addMonths, clampDay, monthOf, parseDateStr, toDateStr, type DateStr, type MonthStr } from './date';
import { formatWon } from './money';
import { josa } from './name';

/** 알림 시간: 이틀 전 / 전날 / 당일 */
export type NotifyWhen = 'twoDaysBefore' | 'dayBefore' | 'sameDay';

export const NOTIFY_WHEN_LABELS: Record<NotifyWhen, string> = { twoDaysBefore: '이틀 전', dayBefore: '전날', sameDay: '당일' };
export const LEAD_DAYS: Record<NotifyWhen, number> = { twoDaysBefore: 2, dayBefore: 1, sameDay: 0 };

export interface NotifySettings {
  on: boolean;
  when: NotifyWhen;
  /** HH:MM */
  time: string;
}

/** 기본은 알림 켜짐, 전날 오후 8시(U3-2). */
export const DEFAULT_NOTIFY: NotifySettings = { on: true, when: 'dayBefore', time: '20:00' };

export function nextMonth(m: MonthStr): MonthStr {
  const [y, mm] = m.split('-').map(Number);
  const n = addMonths(y, mm, 1);
  return `${n.y}-${String(n.m).padStart(2, '0')}`;
}

export function prevMonth(m: MonthStr): MonthStr {
  const [y, mm] = m.split('-').map(Number);
  const n = addMonths(y, mm, -1);
  return `${n.y}-${String(n.m).padStart(2, '0')}`;
}

/** 그 달의 결제일. 31일 결제는 짧은 달의 마지막 날. */
export function payDateOf(month: MonthStr, day: number): DateStr {
  const [y, m] = month.split('-').map(Number);
  return clampDay(y, m, day);
}

/** `after` 다음 달부터 `until`까지(둘 다 YYYY-MM). 빠진 달을 모두 만들 때 씁니다. */
export function monthsToMake(after: MonthStr, until: MonthStr): MonthStr[] {
  const out: MonthStr[] = [];
  for (let m = nextMonth(after); m <= until; m = nextMonth(m)) out.push(m);
  return out;
}

/**
 * 새 정기 결제(또는 다시 켠 결제)가 기록을 어디서부터 만들지 정합니다.
 * 이번 달 결제일이 아직 안 지났으면 이번 달부터(예정 기록), 지났으면 다음 달부터 만듭니다.
 * 돌려주는 값은 "이 달까지는 만든 것으로 친다"는 lastMonth입니다.
 */
export function startLastMonth(todayStr: DateStr, day: number): MonthStr {
  const m = monthOf(todayStr);
  return payDateOf(m, day) >= todayStr ? prevMonth(m) : m;
}

export function addDays(date: DateStr, n: number): DateStr {
  const { y, m, d } = parseDateStr(date);
  return toDateStr(new Date(y, m - 1, d + n));
}

export function daysBetween(from: DateStr, to: DateStr): number {
  const a = parseDateStr(from);
  const b = parseDateStr(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

/** 오늘부터 `lead`일 안에 있는 결제일(가까운 것부터 최대 2개 달을 봄). */
export function payDatesWithin(day: number, todayStr: DateStr, lead: number): DateStr[] {
  const m = monthOf(todayStr);
  const end = addDays(todayStr, lead);
  return [payDateOf(m, day), payDateOf(nextMonth(m), day)].filter((d) => d >= todayStr && d <= end);
}

export function dayWord(diff: number): string {
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : diff === 2 ? '모레' : `${diff}일 뒤`;
}

/** 기록 탭 안내 문구: "내일 정기 결제가 있어요" */
export function bannerText(diff: number): string {
  return `${dayWord(diff)} 정기 결제가 있어요`;
}

/** 폰 알림 문구: "내일은 가수 A의 버블 4,500원이 나가는 날이에요" */
export function notifyText(diff: number, target: string, item: string, amount: number): string {
  const w = dayWord(diff);
  const won = formatWon(amount);
  return `${josa(w, '은/는')} ${target}의 ${item} ${josa(won, '이/가')} 나가는 날이에요`;
}

/** 20:00 → 저녁 8시, 09:30 → 오전 9시 30분 */
export function formatTime(time: string): string {
  const [h, mm] = time.split(':').map(Number);
  const part = h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${h12}시${mm ? ` ${mm}분` : ''}`;
}

/** 금액 화면·정기 결제 화면 설명: "매달 13일 · 전날 저녁 8시에 알림" */
export function repeatSummary(day: number, n: NotifySettings): string {
  return `매달 ${day}일 · ${n.on ? `${NOTIFY_WHEN_LABELS[n.when]} ${formatTime(n.time)}에 알림` : '알림 꺼짐'}`;
}
