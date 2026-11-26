import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { saveRecord } from '../../data/repo/records';
import { addRecurringFromRecord, getNotify } from '../../data/repo/recurring';
import { askPermissionOnce } from '../../services/notify';
import { repeatSummary } from '../../domain/recurring';
import { Switch } from '../../components/Switch';
import { PlaceSheet } from '../../components/PlaceSheet';
import { placeLabel } from '../../data/repo/places';
import { DatePicker } from '../../components/DatePicker';
import { Keypad } from '../../components/Keypad';
import { MemoSheet } from '../../components/MemoSheet';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { formatDateLong, isScheduled, parseDateStr, today } from '../../domain/date';
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
  const [repeat, setRepeat] = useState(false);
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [placing, setPlacing] = useState(false);
  const place = useLiveQuery(async () => (placeId ? (await getDb().places.get(placeId)) ?? null : null), [placeId]);
  const notify = useLiveQuery(() => getNotify(getDb()), []);

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
      const db = getDb();
      if (repeat) void askPermissionOnce(db);
      const rec = await saveRecord(db, { targetId, categoryId, detailId, paid: amount, date, etcText, memo, placeId });
      if (repeat) await addRecurringFromRecord(db, rec.id);
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
        <button type="button" className={s.row} onClick={() => setPlacing(true)}>
          <span className={s.rowLabel}>장소</span>
          <span className={s.rowValue}>
            {place ? placeLabel(place) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>선택</span>}
            <span aria-hidden="true">›</span>
          </span>
        </button>
        <div className={s.row}>
          <span className={`${s.rowLabel} ${s.grow1}`}>
            매달 반복
            {repeat && notify && <span className={s.sub}>{repeatSummary(parseDateStr(date).d, notify)}</span>}
          </span>
          <Switch checked={repeat} onChange={setRepeat} label="매달 반복" />
        </div>
        {detail.isEtc && (
          <label className={s.row}>
            <span className={s.rowLabel}>기타 내용</span>
            <input className={s.inline} placeholder="선택 · 예: 응원봉" maxLength={40} value={etcText} onChange={(e) => setEtcText(e.target.value)} />
          </label>
        )}
        <button type="button" className={s.row} aria-haspopup="dialog" onClick={() => setMemoOpen(true)}>
          <span className={s.rowLabel}>메모</span>
          <span className={`${s.rowValue} ${s.memoPreview}`}>
            {memo ? memo : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>추가</span>}
            <span aria-hidden="true">›</span>
          </span>
        </button>
      </div>
      <div className={s.grow} />
      <Keypad value={amount} onChange={setAmount} />
      <button type="button" className={u.primary} disabled={!amount || saving} onClick={() => void save()}>저장</button>
      <MemoSheet open={memoOpen} value={memo} onClose={() => setMemoOpen(false)} onSave={(m) => { setMemo(m); setMemoOpen(false); }} />
      <PlaceSheet open={placing} value={placeId} onClose={() => setPlacing(false)} onPick={(id) => { setPlaceId(id ?? undefined); setPlacing(false); }} />
      <Sheet open={picking} onClose={() => setPicking(false)} title="날짜">
        <DatePicker value={date} today={todayStr} onSelect={(d) => { setDate(d); setPicking(false); }} />
      </Sheet>
    </div>
  );
}
