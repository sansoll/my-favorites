import { useState } from 'react';
import { addMonths, daysInMonth, parseDateStr, today as todayStr, WEEKDAY_NAMES, type DateStr } from '../domain/date';
import s from './DatePicker.module.css';

export interface DatePickerProps {
  value: DateStr;
  onSelect: (date: DateStr) => void;
  /** 이 날짜 뒤로는 고를 수 없음(체크 달력 등) */
  max?: DateStr;
  today?: DateStr;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 날짜 달력. 달을 넘기고, 날짜를 고르면 onSelect를 부릅니다(닫기는 부모가 함). */
export function DatePicker({ value, onSelect, max, today = todayStr() }: DatePickerProps) {
  const v = parseDateStr(value);
  const [ym, setYm] = useState({ y: v.y, m: v.m });
  const first = new Date(ym.y, ym.m - 1, 1).getDay();
  const n = daysInMonth(ym.y, ym.m);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  const maxYm = max ? max.slice(0, 7) : null;
  const curYm = `${ym.y}-${pad(ym.m)}`;
  const canNext = !maxYm || curYm < maxYm;

  return (
    <div className={s.wrap}>
      <div className={s.nav}>
        <button type="button" className={s.navBtn} aria-label="지난달" onClick={() => setYm(addMonths(ym.y, ym.m, -1))}>◂</button>
        <p className={s.month} aria-live="polite">{ym.y}년 {ym.m}월</p>
        <button type="button" className={s.navBtn} aria-label="다음 달" disabled={!canNext} onClick={() => setYm(addMonths(ym.y, ym.m, 1))}>▸</button>
      </div>
      <div className={s.grid} role="grid" aria-label={`${ym.y}년 ${ym.m}월`}>
        {WEEKDAY_NAMES.map((w, i) => <span key={w} className={`${s.wd} ${i === 0 ? s.sun : ''}`} aria-hidden="true">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const date = `${curYm}-${pad(d)}`;
          const isToday = date === today;
          const isSel = date === value;
          const disabled = !!max && date > max;
          return (
            <button
              key={date}
              type="button"
              className={`${s.day} ${isToday ? s.today : ''} ${isSel ? s.selected : ''}`}
              aria-label={`${ym.m}월 ${d}일${isToday ? ' 오늘' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSel}
              disabled={disabled}
              onClick={() => onSelect(date)}
            >{d}</button>
          );
        })}
      </div>
      <div className={s.foot}>
        <button type="button" className={s.todayBtn} onClick={() => onSelect(today)}>오늘로</button>
      </div>
    </div>
  );
}
