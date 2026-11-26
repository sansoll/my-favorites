import { addMonths, monthOf, type DateStr, type MonthStr } from './date';
import type { CheckCover } from '../data/types';

/** 체크한 날 수: 그 달(YYYY-MM) 또는 그 해(YYYY)로 시작하는 날짜만 셉니다. */
export function countIn(dates: Iterable<DateStr>, prefix: string): number {
  let n = 0;
  for (const d of dates) if (d.startsWith(prefix)) n++;
  return n;
}

export function shiftMonth(ym: MonthStr, delta: number): MonthStr {
  const [y, m] = ym.split('-').map(Number);
  const n = addMonths(y, m, delta);
  return `${n.y}-${String(n.m).padStart(2, '0')}`;
}

export interface CheckCounts {
  month: number;
  prevMonth: number;
  year: number;
}

/** 항목별 그 달·지난달·그 해 체크한 날 수(U4-2). 기본은 오늘이 속한 달. */
export function checkCounts(dates: Iterable<DateStr>, ym: MonthStr): CheckCounts {
  const arr = [...dates];
  return { month: countIn(arr, ym), prevMonth: countIn(arr, shiftMonth(ym, -1)), year: countIn(arr, ym.slice(0, 4)) };
}

/** 이 달의 표지: 그 달만 정한 게 있으면 그것, 없으면 모든 달 표지. */
export function coverFor(cover: CheckCover | undefined, ym: MonthStr): string | null {
  if (!cover) return null;
  return ym in cover.months ? cover.months[ym] : cover.all;
}

export function canCheck(date: DateStr, todayStr: DateStr): boolean {
  return date <= todayStr;
}

/** 달력 칸: 앞쪽 빈칸(일요일 시작) + 그 달 날짜. 7의 배수로 뒤를 채웁니다. */
export function monthGrid(ym: MonthStr): (DateStr | null)[] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const cells: (DateStr | null)[] = Array(first).fill(null);
  for (let d = 1; d <= last; d++) cells.push(`${ym}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function isCurrentOrPast(ym: MonthStr, todayStr: DateStr): boolean {
  return ym <= monthOf(todayStr);
}

export interface Size { w: number; h: number }

/**
 * 사진 창문 보기: 사진을 달력 전체에 cover로 깔았을 때의 크기와 위치.
 * 각 칸은 같은 사진을 같은 크기로 깔고 칸 위치만큼 당겨서, 칸이 창문처럼 사진의 맞는 부분을 보여 줍니다.
 */
export function coverFit(img: Size, box: Size): { w: number; h: number; x: number; y: number } {
  if (!img.w || !img.h || !box.w || !box.h) return { w: box.w, h: box.h, x: 0, y: 0 };
  const s = Math.max(box.w / img.w, box.h / img.h);
  const w = img.w * s;
  const h = img.h * s;
  return { w, h, x: (box.w - w) / 2, y: (box.h - h) / 2 };
}
