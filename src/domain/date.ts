/** 날짜는 모두 `YYYY-MM-DD` 문자열(폰의 현지 시각 기준)로 다룹니다. */
export type DateStr = string;
export type MonthStr = string; // YYYY-MM

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): DateStr {
  return toDateStr(now);
}

export function parseDateStr(s: DateStr): { y: number; m: number; d: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`날짜 형식이 아니에요: ${s}`);
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** 오늘보다 뒤 날짜면 예정입니다. */
export function isScheduled(date: DateStr, todayStr: DateStr = today()): boolean {
  return date > todayStr;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** m은 1~12 */
export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 그 달에 없는 날(31일 등)은 그 달 마지막 날로 바꿉니다. */
export function clampDay(y: number, m: number, day: number): DateStr {
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function monthOf(date: DateStr): MonthStr {
  return date.slice(0, 7);
}

/** 달 범위: 시작일과 마지막 날(둘 다 포함) */
export function monthRange(y: number, m: number): { start: DateStr; end: DateStr } {
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
}

export function yearRange(y: number): { start: DateStr; end: DateStr } {
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export function inRange(date: DateStr, r: { start: DateStr; end: DateStr }): boolean {
  return date >= r.start && date <= r.end;
}

/** 달을 앞뒤로 옮깁니다. delta가 -1이면 지난달. */
export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026. 11. 13 (금) */
export function formatDateLong(date: DateStr): string {
  const { y, m, d } = parseDateStr(date);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${y}. ${m}. ${d} (${w})`;
}

/** 11월 13일 */
export function formatMonthDay(date: DateStr): string {
  const { m, d } = parseDateStr(date);
  return `${m}월 ${d}일`;
}

export function weekdayOf(date: DateStr): number {
  const { y, m, d } = parseDateStr(date);
  return new Date(y, m - 1, d).getDay();
}

export const WEEKDAY_NAMES = WEEK;
