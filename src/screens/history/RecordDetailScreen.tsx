import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { deleteRecords, EditError, mapToTarget, restoreRecords, updateRecord, type RecordEdit } from '../../data/repo/edit';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DatePicker } from '../../components/DatePicker';
import { ListPicker, type ListPick } from '../../components/ListPicker';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { formatDateLong, isScheduled, today } from '../../domain/date';
import { formatNumber, formatWon, MAX_DIGITS, parseDigits } from '../../domain/money';
import { useLookups } from '../../hooks/useLookups';
import { PlaceSheet } from '../../components/PlaceSheet';
import { linkNamePlace, mapUrl, placeLabel } from '../../data/repo/places';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Detail.module.css';

/** 기록 상세: 처음에는 보기 전용. `수정`을 눌러야 고칠 수 있고, `삭제`도 수정 중에만 보입니다. */
export function RecordDetailScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const todayStr = today();
  const rec = useLiveQuery(() => getDb().records.get(id).then((x) => x ?? null), [id]);
  const lk = useLookups();
  const placeOf = useLiveQuery(async () => (await getDb().places.toArray()), []);
  const [draft, setDraft] = useState<RecordEdit | null>(null);
  const [sheet, setSheet] = useState<'date' | 'list' | 'place' | 'link' | null>(null);
  const [pick, setPick] = useState<Partial<ListPick>>({});
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (rec === undefined || !lk) return null;
  if (rec === null) {
    return (
      <div className={r.screen}>
        <p className={r.empty}>이 기록은 없어요.</p>
        <Link to="/history" className={r.more}>내역으로</Link>
      </div>
    );
  }

  const editing = draft !== null;
  const v: RecordEdit = draft ?? { date: rec.date, targetId: rec.targetId, categoryId: rec.categoryId, detailId: rec.detailId, paid: rec.paid, refund: rec.refund, memo: rec.memo, etcText: rec.etcText, placeId: rec.placeId };
  const t = lk.targets.get(v.targetId);
  const c = lk.categories.get(v.categoryId);
  const d = lk.details.get(v.detailId);
  const refundTooBig = v.refund > v.paid;
  const set = (p: Partial<RecordEdit>) => setDraft({ ...v, ...p });

  const save = async () => {
    try {
      await updateRecord(getDb(), rec.id, v);
      setDraft(null);
      setErr(null);
      toast('저장했어요');
    } catch (e) {
      if (e instanceof EditError) setErr(e.reason === 'amount' ? '결제 금액을 넣어 주세요.' : e.reason === 'refund' ? '환불 금액은 결제 금액보다 클 수 없어요.' : '대상·분류·세부를 다시 골라 주세요.');
      else throw e;
    }
  };
  const del = async () => {
    const snap = await deleteRecords(getDb(), [rec.id]);
    setConfirmDel(false);
    nav('/history', { replace: true });
    toast('기록을 삭제했어요', { action: { label: '되돌리기', onClick: () => void restoreRecords(getDb(), snap) } });
  };
  /** 대상을 바꾸면 같은 이름의 분류·세부를 찾고, 없으면 기타로(기타 내용에 이전 이름). */
  const applyPick = async () => {
    if (!pick.targetId) return;
    if (pick.categoryId) {
      const det = pick.detailId ?? (await getDb().details.where('categoryId').equals(pick.categoryId).toArray()).find((x) => x.isEtc)!.id;
      set({ targetId: pick.targetId, categoryId: pick.categoryId, detailId: det });
    } else {
      const m = await mapToTarget(getDb(), v, pick.targetId);
      set({ targetId: pick.targetId, ...m });
    }
    setSheet(null);
  };

  const money = (label: string, key: 'paid' | 'refund') => (
    <label className={s.row}>
      <span className={s.label}>{label}</span>
      <input
        className={s.input}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={key === 'refund' && refundTooBig}
        value={formatNumber(v[key])}
        onChange={(e) => { const n = parseDigits(e.target.value); if (String(n).length <= MAX_DIGITS) set({ [key]: n }); }}
      />
    </label>
  );

  return (
    <div className={r.screen}>
      <div className={r.head}>
        <div className={r.crumbs}>
          {editing ? null : <Link to="/history" className={r.back} aria-label="뒤로">‹</Link>}
          <h1 className={r.title} style={{ fontSize: '1.25rem' }}>{editing ? '기록 수정' : '기록 상세'}</h1>
        </div>
        {editing
          ? <button type="button" className={u.ghost} onClick={() => { setDraft(null); setErr(null); }}>취소</button>
          : <button type="button" className={u.ghost} onClick={() => setDraft(v)}>수정</button>}
      </div>
      <div className={s.rows}>
        {editing ? (
          <button type="button" className={s.row} onClick={() => setSheet('date')}><span className={s.label}>날짜</span><span className={s.value}>{formatDateLong(v.date)} ›</span></button>
        ) : (
          <div className={s.row}><span className={s.label}>날짜</span><span className={s.value}>{formatDateLong(v.date)}{isScheduled(v.date, todayStr) && <span className={s.badge}>예정</span>}</span></div>
        )}
        {editing ? (
          <button type="button" className={s.row} onClick={() => { setPick({ targetId: v.targetId }); setSheet('list'); }}>
            <span className={s.label}>대상 · 분류 · 세부</span>
            <span className={s.value}><span className={s.dot} style={{ background: t?.color }} aria-hidden="true" />{t?.name} › {c?.name} › {d?.name} ›</span>
          </button>
        ) : (
          <>
            <div className={s.row}><span className={s.label}>대상</span><span className={s.value}><span className={s.dot} style={{ background: t?.color }} aria-hidden="true" />{t?.name}</span></div>
            <div className={s.row}><span className={s.label}>분류</span><span className={s.value}>{c?.name}</span></div>
            <div className={s.row}><span className={s.label}>세부</span><span className={s.value}>{d?.name}</span></div>
          </>
        )}
        {d?.isEtc && (editing
          ? <label className={s.row}><span className={s.label}>기타 내용</span><input className={`${s.input} ${s.textInput}`} maxLength={60} value={v.etcText} onChange={(e) => set({ etcText: e.target.value })} /></label>
          : v.etcText && <div className={s.row}><span className={s.label}>기타 내용</span><span className={s.value}>{v.etcText}</span></div>)}
        {editing ? money('결제 금액', 'paid') : <div className={s.row}><span className={s.label}>결제 금액</span><span className={s.value}>{formatWon(v.paid)}</span></div>}
        {editing ? money('환불 금액', 'refund') : <div className={s.row}><span className={s.label}>환불 금액</span><span className={s.value}>{formatWon(v.refund)}</span></div>}
        <div className={s.row}><span className={s.label}>집계 금액</span><span className={`${s.value} ${s.net}`}>{formatWon(Math.max(0, v.paid - v.refund))}</span></div>
        {(() => {
          const pl = v.placeId ? placeOf?.find((x) => x.id === v.placeId) : undefined;
          if (editing) {
            return (
              <button type="button" className={s.row} onClick={() => setSheet('place')}>
                <span className={s.label}>장소</span>
                <span className={s.value}>{pl ? placeLabel(pl) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>없음</span>} ›</span>
              </button>
            );
          }
          if (!pl) return <div className={s.row}><span className={s.label}>장소</span><span className={s.value} style={{ color: 'var(--text-muted)', fontWeight: 400 }}>없음</span></div>;
          return (
            <div className={s.row}>
              <span className={s.label}>장소</span>
              <span className={s.value}>
                <a href={mapUrl(pl)} target="_blank" rel="noopener noreferrer" aria-label={`${placeLabel(pl)} 지도에서 열기`}>{placeLabel(pl)} ↗</a>
                {pl.source === 'name' && <button type="button" className={s.link} onClick={() => setSheet('link')}>장소 연결하기</button>}
              </span>
            </div>
          );
        })()}
        {editing
          ? <label className={s.row}><span className={s.label}>메모</span><input className={`${s.input} ${s.textInput}`} maxLength={500} value={v.memo} onChange={(e) => set({ memo: e.target.value })} /></label>
          : <div className={s.row}><span className={s.label}>메모</span><span className={s.value} style={v.memo ? undefined : { color: 'var(--text-muted)', fontWeight: 400 }}>{v.memo || '메모 없음'}</span></div>}
      </div>
      {editing && refundTooBig && <p className={s.warn} role="alert">환불 금액은 결제 금액보다 클 수 없어요.</p>}
      {editing && err && !refundTooBig && <p className={s.warn} role="alert">{err}</p>}
      {editing && (
        <div className={s.actions}>
          <button type="button" className={s.del} onClick={() => setConfirmDel(true)}>삭제</button>
          <button type="button" className={u.primary} disabled={refundTooBig || !v.paid} onClick={() => void save()}>저장</button>
        </div>
      )}
      <Sheet open={sheet === 'date'} onClose={() => setSheet(null)} title="날짜">
        <DatePicker value={v.date} today={todayStr} onSelect={(x) => { set({ date: x }); setSheet(null); }} />
      </Sheet>
      <Sheet open={sheet === 'list'} onClose={() => setSheet(null)} title="대상 · 분류 · 세부" kicker="대상만 바꾸면 같은 이름의 분류·세부로 옮겨요">
        <ListPicker value={pick} onChange={setPick} detailOptional />
        <button type="button" className={u.primary} disabled={!pick.targetId} onClick={() => void applyPick()}>이걸로</button>
      </Sheet>
      <PlaceSheet open={sheet === 'place'} value={v.placeId} onClose={() => setSheet(null)} onPick={(id) => { set({ placeId: id ?? undefined }); setSheet(null); }} />
      <PlaceSheet open={sheet === 'link'} onClose={() => setSheet(null)} onPick={() => setSheet(null)}
        linkMode={{ onResult: async (res) => { if (!rec.placeId) return; await linkNamePlace(getDb(), rec.placeId, res); setSheet(null); toast('장소를 연결했어요'); } }} />
      <ConfirmDialog open={confirmDel} title="이 기록을 삭제할까요?" body="내역과 통계에서 빠져요." onCancel={() => setConfirmDel(false)} onConfirm={() => void del()} />
    </div>
  );
}
