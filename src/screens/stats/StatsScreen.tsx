import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { today } from '../../domain/date';
import { formatWon } from '../../domain/money';
import { computeStats, isCurrentPeriod, periodLabel, shiftPeriod, type Period, type RankRow, type StatsMode } from '../../domain/stats';
import { useLookups } from '../../hooks/useLookups';
import s from './Stats.module.css';

function Bars({ title, rows, color }: { title: string; rows: RankRow[]; color?: string }) {
  const max = rows[0]?.amount ?? 1;
  return (
    <section className={s.section} aria-label={title}>
      <h2 className={s.h2}>{title}</h2>
      <ol className={s.bars}>
        {rows.map((r) => (
          <li key={r.key} className={s.bar}>
            <span className={s.rank}>{r.rank}</span>
            <span className={s.name}>{r.name}</span>
            <span className={s.track} aria-hidden="true"><span className={s.fill} style={{ width: `${Math.max(4, (r.amount / max) * 100)}%`, background: r.color ?? color ?? 'var(--accent)' }} /></span>
            <span className={s.amount}>{formatWon(r.amount)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 통계(STORYBOARD 6-1, U6-2). */
export function StatsScreen() {
  const todayStr = today();
  const [ty, tm] = todayStr.split('-').map(Number);
  const [p, setP] = useState<Period>({ mode: 'month', y: ty, m: tm });
  const records = useLiveQuery(() => getDb().records.toArray(), []);
  const l = useLookups();
  if (!records || !l) return null;
  const st = computeStats(records, l, p);
  const atNow = isCurrentPeriod(p, todayStr);
  const setMode = (mode: StatsMode) => setP({ mode, y: ty, m: tm });
  const diff = st.total - st.prevTotal;
  const unit = p.mode === 'month' ? '달' : '해';

  return (
    <div className={s.screen}>
      <div className={s.head}>
        <div className={s.titleRow}>
          <h1 className={s.title}>통계</h1>
          <div className={s.seg} role="radiogroup" aria-label="기간">
            {(['month', 'year'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={p.mode === k} className={`${s.segBtn} ${p.mode === k ? s.segOn : ''}`} onClick={() => setMode(k)}>{k === 'month' ? '월' : '연'}</button>
            ))}
          </div>
        </div>
        <div className={s.nav}>
          <button type="button" className={s.navBtn} aria-label="이전 기간" onClick={() => setP(shiftPeriod(p, -1))}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <span className={s.period} aria-live="polite">{periodLabel(p)}</span>
          <button type="button" className={s.navBtn} aria-label="다음 기간" disabled={atNow} onClick={() => setP(shiftPeriod(p, 1))}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div className={s.body}>
        <div className={s.total}>
          <span className={s.totalLabel}>{atNow ? `이번 ${unit} 총액` : `${periodLabel(p)} 총액`}</span>
          <span className={s.totalValue}>{formatWon(st.total)}</span>
          <span className={s.prev}>
            {p.mode === 'month' ? '지난달' : '작년'} {formatWon(st.prevTotal)}
            {st.prevTotal > 0 && diff !== 0 && <> · {diff > 0 ? `${formatWon(diff)} 더 썼어요` : `${formatWon(-diff)} 덜 썼어요`}</>}
          </span>
        </div>
        {st.count === 0 ? (
          <p className={s.empty}>이 기간에는 기록이 없어요.</p>
        ) : (
          <>
            <div className={s.tops}>
              <div className={s.top}><span className={s.topLabel}>1위 대상</span><span className={s.topValue}>{st.targets[0]?.name ?? '없음'}</span></div>
              <div className={s.top}><span className={s.topLabel}>1위 분류</span><span className={s.topValue}>{st.categories[0]?.name ?? '없음'}</span></div>
            </div>
            <Bars title="대상 랭킹" rows={st.targets} />
            <Bars title="분류 랭킹" rows={st.categories} />
            <section className={s.section} aria-label="세부 랭킹">
              <h2 className={s.h2}>세부 랭킹</h2>
              <ol className={s.list}>
                {st.details.map((r) => (
                  <li key={r.key} className={s.listRow}><span><span className={s.rank}>{r.rank}</span>{r.name}</span><span className={s.amountStrong}>{formatWon(r.amount)}</span></li>
                ))}
              </ol>
            </section>
          </>
        )}
        <div className={s.links}>
          <Link to="/stats/places" className={s.placesBtn}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            다녀온 곳
          </Link>
        </div>
      </div>
    </div>
  );
}
