import { addMonths, clampDay, daysInMonth, formatDateLong, inRange, isScheduled, monthRange, today, yearRange } from './date';

describe('날짜 도구 (U0-4)', () => {
  it('오늘을 YYYY-MM-DD로', () => {
    expect(today(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(today(new Date(2027, 0, 1, 23, 59))).toBe('2027-01-01');
  });

  it('미래 날짜면 예정', () => {
    expect(isScheduled('2026-11-14', '2026-11-13')).toBe(true);
    expect(isScheduled('2026-11-13', '2026-11-13')).toBe(false);
    expect(isScheduled('2026-11-12', '2026-11-13')).toBe(false);
  });

  it('31일은 그 달 마지막 날로', () => {
    expect(clampDay(2026, 11, 31)).toBe('2026-11-30');
    expect(clampDay(2026, 2, 31)).toBe('2026-02-28');
    expect(clampDay(2028, 2, 31)).toBe('2028-02-29');
    expect(clampDay(2026, 12, 31)).toBe('2026-12-31');
    expect(clampDay(2026, 4, 5)).toBe('2026-04-05');
  });

  it('윤년', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it('월·연 범위', () => {
    expect(monthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(yearRange(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(inRange('2026-02-28', monthRange(2026, 2))).toBe(true);
    expect(inRange('2026-03-01', monthRange(2026, 2))).toBe(false);
  });

  it('달 넘기기', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2026, 5, -17)).toEqual({ y: 2024, m: 12 });
  });

  it('표시 형식', () => {
    expect(formatDateLong('2026-11-13')).toBe('2026. 11. 13 (금)');
  });
});
