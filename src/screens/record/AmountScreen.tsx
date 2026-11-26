import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { saveRecord } from '../../data/repo/records';
import { DatePicker } from '../../components/DatePicker';
import { Keypad } from '../../components/Keypad';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { formatDateLong, isScheduled, today } from '../../domain/date';
import { formatNumber, formatWon } from '../../domain/money';
import u from '../../components/ui.module.css';
import r from './Record.module.css';
import s from './Amount.module.css';

/** 기록 4: 금액. 저장하면 기록(대상) 화면으로 돌아가 "저장했어요" 알림. */
export function AmountScreen() {
  const { targetId = '', categoryId = '', detailId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const todayStr = today();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [target, category, detail] = await Promise.all([db.targets.get(targetId), db.categories.get(categoryId), db.details.get(detailId)]);
    return { target, category, detail };
  }, [targetId, categoryId, detailId]);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayStr);
  const [picking, setPicking] = useState(false);
  const [etcText, setEtcText] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  if (!data) return null;
  const { target, category, detail } = data;
  if (!target || !category || !detail) {
    return (
      <div className={s.screen}>
        <p className={r.empty}>찾는 항목이 없어요.</p>
        <Link to="/" className={r.more}>기록 화면으로</Link>
      </div>
    );
  }

  const save = async () => {
    if (!amount || saving) return;
    setSaving(true);
    try {
      await saveRecord(getDb(), { targetId, categoryId, detailId, paid: amount, date, etcText, memo });
      const name = detail.isEtc && etcText.trim() ? etcText.trim() : detail.name;
      toast(`${target.name} › ${category.name} › ${name} ${formatWon(amount)}을 저장했어요`);
      nav('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.screen}>
      <div className={r.crumbs}>
        <Link to={`/record/${target.id}/${category.id}`} className={r.back} aria-label="뒤로">‹</Link>
        <Link to={`/record/${target.id}`} className={r.crumb}><span className={r.dot} style={{ background: target.color }} aria-hidden="true" />{target.name}</Link>
        <span className={r.sep} aria-hidden="true">›</span>
        <Link to={`/record/${target.id}/${category.id}`} className={r.crumb}>{category.name}</Link>
        <span className={r.sep} aria-hidden="true">›</span>
        <span className={r.crumb}>{detail.name}</span>
      </div>
      <h1 className="sr-only">금액 입력</h1>
      <output className={s.amount} aria-live="polite" aria-label={`금액 ${formatWon(amount)}`}>
        <span className={`${s.num} ${amount ? '' : s.zero}`}>{formatNumber(amount)}</span>
        <span className={s.won}>원</span>
      </output>
      <div className={s.rows}>
        <button type="button" className={s.row} onClick={() => setPicking(true)}>
          <span className={s.rowLabel}>날짜</span>
          <span className={s.rowValue}>
            {formatDateLong(date)}{date === todayStr && ' 오늘'}
            {isScheduled(date, todayStr) && <span className={s.badge}>예정</span>}
            <span aria-hidden="true">›</span>
          </span>
        </button>
        {detail.isEtc && (
          <label className={s.row}>
            <span className={s.rowLabel}>기타 내용</span>
            <input className={s.inline} placeholder="선택 · 예: 응원봉" maxLength={40} value={etcText} onChange={(e) => setEtcText(e.target.value)} />
          </label>
        )}
        <button type="button" className={s.row} aria-expanded={memoOpen} onClick={() => setMemoOpen(!memoOpen)}>
          <span className={s.rowLabel}>{memo.trim() ? '메모' : '메모 추가'}</span>
          <span className={s.rowValue} aria-hidden="true">{memoOpen ? '▴' : '▾'}</span>
        </button>
        {memoOpen && <textarea className={s.memo} aria-label="메모" maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} />}
      </div>
      <div className={s.grow} />
      <Keypad value={amount} onChange={setAmount} />
      <button type="button" className={u.primary} disabled={!amount || saving} onClick={() => void save()}>저장</button>
      <Sheet open={picking} onClose={() => setPicking(false)} title="날짜">
        <DatePicker value={date} today={todayStr} onSelect={(d) => { setDate(d); setPicking(false); }} />
      </Sheet>
    </div>
  );
}
