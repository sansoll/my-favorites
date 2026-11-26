import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { deleteRecords, moveRecords, restoreRecords } from '../../data/repo/edit';
import { listTargets } from '../../data/repo/lists';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListPicker, type ListPick } from '../../components/ListPicker';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { formatMonthDay, isScheduled, today } from '../../domain/date';
import { groupHistory, PERIOD_LABELS, type Period } from '../../domain/history';
import { formatWon } from '../../domain/money';
import { net } from '../../domain/totals';
import { recordPath, useLookups } from '../../hooks/useLookups';
import u from '../../components/ui.module.css';
import s from './History.module.css';

export function HistoryScreen() {
  const toast = useToast();
  const todayStr = today();
  const records = useLiveQuery(() => getDb().records.toArray(), []);
  const targets = useLiveQuery(() => listTargets(getDb()), []) ?? [];
  const lk = useLookups();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [sheet, setSheet] = useState<'target' | 'period' | 'move' | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [moveTo, setMoveTo] = useState<Partial<ListPick>>({});

  if (!records || !lk) return <Screen title="내역" />;
  const groups = groupHistory(records, { targetId, period }, todayStr);
  const pickedRows = records.filter((r) => picked.has(r.id));
  const pickedSum = pickedRows.reduce((a, r) => a + net(r), 0);
  const endSelect = () => { setSelecting(false); setPicked(new Set()); };
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const doDelete = async () => {
    const snap = await deleteRecords(getDb(), [...picked]);
    setConfirmDel(false);
    endSelect();
    toast(`기록 ${snap.length}건을 삭제했어요`, { action: { label: '되돌리기', onClick: () => void restoreRecords(getDb(), snap) } });
  };
  const doMove = async () => {
    if (!moveTo.targetId || !moveTo.categoryId) return;
    const n = await moveRecords(getDb(), [...picked], moveTo as ListPick);
    setSheet(null);
    setMoveTo({});
    endSelect();
    toast(`기록 ${n}건을 옮겼어요`);
  };

  return (
    <Screen
      title={selecting ? `${picked.size}건 선택` : '내역'}
      actions={<button type="button" className={u.ghost} onClick={() => (selecting ? endSelect() : setSelecting(true))}>{selecting ? '완료' : '선택'}</button>}
    >
      <div className={s.filters}>
        <button type="button" className={s.filter} onClick={() => setSheet('target')}>{targetId ? lk.targets.get(targetId)?.name ?? '전체 대상' : '전체 대상'} ▾</button>
        <button type="button" className={s.filter} onClick={() => setSheet('period')}>{PERIOD_LABELS[period]} ▾</button>
      </div>
      {selecting && <p className={u.hint}>옮기거나 지울 기록을 눌러 고르세요.</p>}
      <div>
        {groups.length === 0 && <p className={s.empty}>{records.length ? '조건에 맞는 기록이 없어요.' : '아직 기록이 없어요.'}</p>}
        {groups.map((g) => (
          <section key={g.date} className={s.group}>
            <h2 className={s.date}>{formatMonthDay(g.date)}</h2>
            <ul className={s.list}>
              {g.records.map((r) => {
                const t = lk.targets.get(r.targetId);
                const on = picked.has(r.id);
                const inner = (
                  <>
                    {selecting && <span className={`${s.check} ${on ? s.checkOn : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>}
                    <span className={s.main}>
                      <span className={s.target}><span className={s.dot} style={{ background: t?.color }} aria-hidden="true" />{t?.name}{isScheduled(r.date, todayStr) && <span className={s.badge}>예정</span>}</span>
                      <span className={s.path}>{recordPath(lk, r)}</span>
                    </span>
                    <span className={s.right}>
                      <span className={s.amount}>{formatWon(net(r))}</span>
                      {r.refund > 0 && <span className={s.refund}>환불 {formatWon(r.refund)}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={r.id}>
                    {selecting
                      ? <button type="button" className={s.row} role="checkbox" aria-checked={on} onClick={() => toggle(r.id)}>{inner}</button>
                      : <Link to={`/records/${r.id}`} className={s.row}>{inner}</Link>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {selecting && (
        <div className={s.bar}>
          <button type="button" className={u.primary} disabled={!picked.size} onClick={() => setSheet('move')}>옮기기</button>
          <button type="button" className={`${u.primary} ${picked.size ? s.danger : ''}`} disabled={!picked.size} onClick={() => setConfirmDel(true)}>삭제</button>
        </div>
      )}

      <Sheet open={sheet === 'target'} onClose={() => setSheet(null)} title="대상">
        <div>
          {[{ id: null as string | null, name: '전체 대상' }, ...targets].map((t) => (
            <button key={t.id ?? 'all'} type="button" className={`${s.opt} ${targetId === t.id ? s.optOn : ''}`} aria-pressed={targetId === t.id} onClick={() => { setTargetId(t.id); setSheet(null); }}>
              {t.name}{targetId === t.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'period'} onClose={() => setSheet(null)} title="기간">
        <div>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button key={p} type="button" className={`${s.opt} ${period === p ? s.optOn : ''}`} aria-pressed={period === p} onClick={() => { setPeriod(p); setSheet(null); }}>
              {PERIOD_LABELS[p]}{period === p && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'move'} onClose={() => setSheet(null)} title={`기록 ${picked.size}건 옮기기`} kicker="어디로 옮길까요?">
        <ListPicker value={moveTo} onChange={setMoveTo} detailOptional />
        <button type="button" className={u.primary} disabled={!moveTo.categoryId} onClick={() => void doMove()}>옮기기</button>
      </Sheet>
      <ConfirmDialog
        open={confirmDel}
        title={`기록 ${picked.size}건을 삭제할까요?`}
        body={`합계 ${formatWon(pickedSum)}이 지출에서 빠져요. 지운 뒤 잠깐 되돌리기가 나와요.`}
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => void doDelete()}
      />
    </Screen>
  );
}
