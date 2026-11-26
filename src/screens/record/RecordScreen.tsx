import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDb } from '../../data/db';
import { listTargets } from '../../data/repo/lists';
import { recentRecords } from '../../data/repo/records';
import { EditableList } from '../../components/EditableList';
import { formatMonthDay, today } from '../../domain/date';
import { formatWon } from '../../domain/money';
import { net } from '../../domain/totals';
import { useMonthTotals } from '../../hooks/useMonthTotals';
import u from '../../components/ui.module.css';
import { NewTargetSheet } from './NewTargetSheet';
import { useListActions } from './useListActions';
import s from './Record.module.css';

/** 최근 기록은 3건만 보여 줍니다(STORYBOARD 4-1). */
export const RECENT_COUNT = 3;

export function RecordScreen() {
  const nav = useNavigate();
  const todayStr = today();
  const targets = useLiveQuery(() => listTargets(getDb()), []);
  const totals = useMonthTotals(todayStr);
  const recent = useLiveQuery(async () => {
    const db = getDb();
    const rs = await recentRecords(db, RECENT_COUNT, todayStr);
    return Promise.all(rs.map(async (r) => {
      const [t, c, d] = await Promise.all([db.targets.get(r.targetId), db.categories.get(r.categoryId), db.details.get(r.detailId)]);
      return { id: r.id, target: t?.name ?? '', path: `${c?.name ?? ''} › ${d?.isEtc && r.etcText ? r.etcText : d?.name ?? ''}`, date: formatMonthDay(r.date), amount: formatWon(net(r)) };
    }));
  }, [todayStr]) ?? [];
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { onReorder, onAction, sheet } = useListActions('target');

  return (
    <div className={s.screen}>
      <div className={s.head}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <h1 className={s.title}>기록</h1>
          <span className={s.date}>{formatMonthDay(todayStr)}</span>
        </div>
        <button type="button" className={u.ghost} aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? '완료' : '편집'}</button>
      </div>
      <Link to="/stats" className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className={s.cardLabel}>이번 달 지출</span>
        <span className={s.cardValue}>{formatWon(totals.total)}</span>
      </Link>
      <section className={s.section}>
        <h2 className={s.sectionTitle}>누구에게 썼나요?</h2>
        {targets && (
          <EditableList
            label="대상"
            items={targets.map((t) => ({ id: t.id, name: t.name, color: t.color, isEtc: t.isEtc, amount: totals.byTarget.get(t.id) ?? 0 }))}
            editing={editing}
            onEditingChange={setEditing}
            onOpen={(t) => nav(`/record/${t.id}`)}
            onReorder={onReorder}
            onAction={onAction}
            clearDataLabel={'지출 데이터만 삭제'}
          />
        )}
        <button type="button" className={u.dashed} style={{ marginTop: '0.75rem' }} onClick={() => setAdding(true)}>+ 대상 추가</button>
      </section>
      {!editing && recent.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>최근 기록</h2>
            <Link to="/history" className={s.more}>전체 보기</Link>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="최근 기록">
            {recent.map((r) => (
              <li key={r.id}>
                <Link to={`/records/${r.id}`} className={s.recent} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className={s.recentMain}>
                    <span className={s.recentTarget}>{r.target}</span>
                    <span className={s.recentPath}>{r.path} · {r.date}</span>
                  </span>
                  <span className={s.recentAmount}>{r.amount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NewTargetSheet open={adding} onClose={() => setAdding(false)} />
      {sheet}
    </div>
  );
}
