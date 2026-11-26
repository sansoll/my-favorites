import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import {
  addRecurring, deleteRecurring, getNotify, listRecurrings, RecurringError, setNotify, setRecurringEnabled, updateRecurring,
} from '../../data/repo/recurring';
import type { Recurring } from '../../data/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListPicker, type ListPick } from '../../components/ListPicker';
import { Sheet } from '../../components/Sheet';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import { formatNumber, formatWon, parseDigits } from '../../domain/money';
import { formatTime, NOTIFY_WHEN_LABELS, type NotifySettings, type NotifyWhen } from '../../domain/recurring';
import { useLookups } from '../../hooks/useLookups';
import { askPermissionOnce } from '../../services/notify';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import d from '../history/Detail.module.css';
import st from './Settings.module.css';
import s from './Recurring.module.css';

interface Draft {
  id?: string;
  pick: Partial<ListPick>;
  amount: number;
  day: number;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** 설정 › 정기 결제(STORYBOARD 8-1, U3-3). */
export function RecurringScreen() {
  const toast = useToast();
  const items = useLiveQuery(() => listRecurrings(getDb()), []);
  const notify = useLiveQuery(() => getNotify(getDb()), []);
  const l = useLookups();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  if (!items || !notify || !l) return null;

  const describe = (x: Recurring) => {
    const t = l.targets.get(x.targetId)?.name ?? '';
    const c = l.categories.get(x.categoryId)?.name ?? '';
    const det = l.details.get(x.detailId)?.name ?? '';
    return { when: `매달 ${x.day}일`, what: `${t} · ${c} › ${det}`, amount: formatWon(x.amount) };
  };

  const open = (x?: Recurring) => {
    setErr(null);
    setDraft(x ? { id: x.id, pick: { targetId: x.targetId, categoryId: x.categoryId, detailId: x.detailId }, amount: x.amount, day: x.day } : { pick: {}, amount: 0, day: new Date().getDate() });
  };

  const save = async () => {
    if (!draft) return;
    const db = getDb();
    const { targetId, categoryId, detailId } = draft.pick;
    if (!targetId || !categoryId) { setErr('대상과 분류를 골라 주세요.'); return; }
    const input = { targetId, categoryId, detailId, amount: draft.amount, day: draft.day };
    try {
      if (draft.id) {
        await updateRecurring(db, draft.id, input);
        toast('저장했어요');
      } else {
        void askPermissionOnce(db);
        await addRecurring(db, input);
        toast('정기 결제를 추가했어요');
      }
      setDraft(null);
    } catch (e) {
      if (e instanceof RecurringError) setErr(e.reason === 'amount' ? '금액을 넣어 주세요.' : e.reason === 'day' ? '결제일을 골라 주세요.' : '대상·분류·세부를 다시 골라 주세요.');
      else throw e;
    }
  };

  const del = async () => {
    if (!draft?.id) return;
    await deleteRecurring(getDb(), draft.id);
    setConfirmDel(false);
    setDraft(null);
    toast('정기 결제를 삭제했어요');
  };

  const changeNotify = (patch: Partial<NotifySettings>) => void setNotify(getDb(), patch);

  return (
    <div className={r.screen}>
      <div className={r.crumbs}>
        <Link to="/settings" className={r.back} aria-label="뒤로">‹</Link>
        <h1 className={r.title} style={{ fontSize: '1.25rem' }}>정기 결제</h1>
      </div>

      <section className={st.group}>
        <div className={st.row}>
          <span>알림</span>
          <Switch checked={notify.on} onChange={(on) => changeNotify({ on })} label="알림" />
        </div>
        <button type="button" className={`${st.row} ${s.rowBtn}`} disabled={!notify.on} onClick={() => setTimeOpen(true)}>
          <span>알림 시간</span>
          <span className={st.meta}>{NOTIFY_WHEN_LABELS[notify.when]} {formatTime(notify.time)} ›</span>
        </button>
        <p className={u.hint} style={{ marginTop: '0.5rem' }}>알림을 꺼도 기록 탭 안내와 자동 기록은 그대로예요. 폰 알림은 앱을 열 때 보내요.</p>
      </section>

      <section className={st.group}>
        <h2 className={st.groupTitle}>결제</h2>
        {items.length === 0 && <p className={u.hint}>아직 정기 결제가 없어요. 금액 화면에서 `매달 반복`을 켜거나 여기서 추가하세요.</p>}
        <ul className={s.list} aria-label="정기 결제">
          {items.map((x) => {
            const t = describe(x);
            return (
              <li key={x.id} className={s.item}>
                <button type="button" className={s.itemBtn} onClick={() => open(x)} style={x.enabled ? undefined : { opacity: 0.55 }}>
                  <span className={s.when}>{t.when}</span>
                  <span className={s.what}>{t.what}</span>
                  <span className={s.amount}>{t.amount}</span>
                </button>
                <Switch checked={x.enabled} onChange={(on) => void setRecurringEnabled(getDb(), x.id, on)} label={`${t.when} ${t.what} 켜기`} />
              </li>
            );
          })}
        </ul>
        <button type="button" className={u.dashed} style={{ marginTop: '0.75rem' }} onClick={() => open()}>+ 정기 결제 추가</button>
      </section>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? '정기 결제 수정' : '정기 결제 추가'}>
        {draft && (
          <div className={s.form}>
            <ListPicker value={draft.pick} onChange={(pick) => setDraft({ ...draft, pick })} detailOptional />
            <label className={d.row}>
              <span className={d.label}>금액</span>
              <input className={d.input} inputMode="numeric" aria-label="금액" value={draft.amount ? formatNumber(draft.amount) : ''} placeholder="0"
                onChange={(e) => setDraft({ ...draft, amount: parseDigits(e.target.value) })} />
            </label>
            <label className={d.row}>
              <span className={d.label}>결제일</span>
              <select className={d.input} aria-label="결제일" value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })}>
                {DAYS.map((n) => <option key={n} value={n}>매달 {n}일</option>)}
              </select>
            </label>
            {draft.day >= 29 && <p className={u.hint}>그날이 없는 달은 마지막 날에 기록해요.</p>}
            {err && <p className={d.warn} role="alert">{err}</p>}
            <div className={draft.id ? d.actions : undefined}>
              {draft.id && <button type="button" className={d.del} onClick={() => setConfirmDel(true)}>삭제</button>}
              <button type="button" className={u.primary} style={{ width: '100%' }} disabled={!draft.amount} onClick={() => void save()}>저장</button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={timeOpen} onClose={() => setTimeOpen(false)} title="알림 시간">
        <div className={s.form}>
          <div className={u.chips} role="radiogroup" aria-label="언제">
            {(Object.keys(NOTIFY_WHEN_LABELS) as NotifyWhen[]).map((w) => (
              <button key={w} type="button" role="radio" aria-checked={notify.when === w} className={`${u.chip} ${notify.when === w ? u.chipOn : ''}`} onClick={() => changeNotify({ when: w })}>{NOTIFY_WHEN_LABELS[w]}</button>
            ))}
          </div>
          <label className={d.row}>
            <span className={d.label}>시각</span>
            <input type="time" className={d.input} aria-label="시각" value={notify.time} onChange={(e) => e.target.value && changeNotify({ time: e.target.value })} />
          </label>
          <button type="button" className={u.primary} onClick={() => setTimeOpen(false)}>완료</button>
        </div>
      </Sheet>

      <ConfirmDialog open={confirmDel} title="정기 결제를 삭제할까요?" body="이미 만든 기록은 그대로 남아요." onCancel={() => setConfirmDel(false)} onConfirm={() => void del()} />
    </div>
  );
}
