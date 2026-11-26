import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { getDb } from '../data/db';
import { namePlace, placeLabel, recentPlaces, searchPlace } from '../data/repo/places';
import type { Place } from '../data/types';
import { cleanName } from '../domain/name';
import { getPlaceServices, hasHangul, SearchError, type PlaceResult } from '../services/places';
import { Sheet } from './Sheet';
import u from './ui.module.css';
import s from './PlaceSheet.module.css';

/** 국내는 입력을 멈추고 이만큼 지나면 찾습니다. */
export const KAKAO_DEBOUNCE_MS = 400;

type Tab = 'domestic' | 'overseas';
type Pick = { kind: 'place'; place: Place } | { kind: 'result'; result: PlaceResult };

const SOURCE_LABEL = { kakao: '카카오', osm: 'OSM', name: '이름만' } as const;

export interface PlaceSheetProps {
  open: boolean;
  /** 지금 고른 장소 */
  value?: string;
  onClose: () => void;
  /** 고르면 장소 id, `장소 빼기`면 null */
  onPick: (placeId: string | null) => void;
  /** 이름만 장소를 검색 결과로 연결할 때: 고른 결과를 돌려줍니다(전에 간 곳과 이름만 남기기는 숨김). */
  linkMode?: { onResult: (r: PlaceResult) => void };
}

/** 장소 창(STORYBOARD 4-4, U5-4). */
export function PlaceSheet({ open, value, onClose, onPick, linkMode }: PlaceSheetProps) {
  const [tab, setTab] = useState<Tab>('domestic');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  /** 카카오가 안 될 때 국내 탭에서 OpenStreetMap으로 한 번 찾아보기 */
  const [osmFallback, setOsmFallback] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const recent = useLiveQuery(() => recentPlaces(getDb()), []) ?? [];
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQ(''); setResults(null); setStatus('idle'); setErr(null); setPick(null); setTab('domestic');
  }, [open]);

  const run = async (query: string, which: Tab) => {
    const id = ++reqId.current;
    setStatus('loading');
    setErr(null);
    setOsmFallback(false);
    try {
      const svc = getPlaceServices()[which];
      const rs = await svc.search(query);
      if (id !== reqId.current) return;
      setResults(rs);
      setStatus('idle');
    } catch (e) {
      if (id !== reqId.current) return;
      setResults(null);
      setStatus('error');
      const reason = e instanceof SearchError ? e.reason : 'failed';
      setErr(reason === 'offline' ? '인터넷이 없어서 찾을 수 없어요. 이름만 남겨 두고 나중에 연결할 수 있어요.'
        : reason === 'unavailable' ? '지금은 카카오 검색을 쓸 수 없어요. OpenStreetMap으로 찾거나 이름만 남겨 두세요.'
        : reason === 'blocked' ? '카카오 검색이 응답하지 않아요. OpenStreetMap으로 찾거나 이름만 남겨 두세요.'
        : '검색이 잘 안 됐어요. 잠시 뒤 다시 해 보거나 이름만 남겨 두세요.');
      setOsmFallback(which === 'domestic' && reason !== 'offline');
    }
  };

  // 국내: 입력을 멈춘 뒤에만 찾음. 해외: `검색` 버튼에서만 찾음.
  useEffect(() => {
    if (!open || tab !== 'domestic') return;
    const query = q.trim();
    if (!query) { reqId.current++; setResults(null); setStatus('idle'); setErr(null); return; }
    const t = setTimeout(() => void run(query, 'domestic'), KAKAO_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab, open]);

  const switchTab = (t: Tab) => {
    reqId.current++;
    setTab(t); setResults(null); setStatus('idle'); setErr(null);
  };

  const query = cleanName(q);
  const confirm = async () => {
    if (!pick) return;
    if (pick.kind === 'place') { onPick(pick.place.id); return; }
    if (linkMode) { linkMode.onResult(pick.result); return; }
    const p = await searchPlace(getDb(), pick.result);
    onPick(p.id);
  };
  const nameOnly = async () => {
    const p = await namePlace(getDb(), query);
    onPick(p.id);
  };

  const selectedId = pick?.kind === 'place' ? pick.place.id : pick ? undefined : value;
  const isPickedResult = (r: PlaceResult) => pick?.kind === 'result' && pick.result.source === r.source && pick.result.externalId === r.externalId;
  const shownRecent = linkMode ? [] : query ? recent.filter((p) => placeLabel(p).replace(/\s+/g, '').toLowerCase().includes(query.replace(/\s+/g, '').toLowerCase())) : recent;
  const searched = results !== null;
  const empty = searched && results.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title={linkMode ? '장소 연결하기' : '어디였나요?'}>
      <div className={s.body}>
        <div className={s.seg} role="tablist" aria-label="검색 지역">
          {(['domestic', 'overseas'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${s.segBtn} ${tab === t ? s.segOn : ''}`} onClick={() => switchTab(t)}>
              {t === 'domestic' ? '국내' : '해외'}
            </button>
          ))}
        </div>
        <form className={s.searchRow} role="search" onSubmit={(e) => { e.preventDefault(); if (tab === 'overseas' && query) void run(query, 'overseas'); }}>
          <input className={u.input} style={{ flex: 1, minWidth: 0 }} aria-label="장소 검색어" maxLength={60} value={q}
            placeholder={tab === 'domestic' ? '예: KSPO DOME, 고척돔' : '예: Tokyo Dome, Wembley'} onChange={(e) => setQ(e.target.value)} />
          {tab === 'overseas' && <button type="submit" className={u.ghost} disabled={!query}>검색</button>}
        </form>

        <div className={s.list} aria-live="polite">
          {shownRecent.length > 0 && (
            <>
              <h3 className={s.groupTitle}>전에 간 곳</h3>
              <ul className={s.ul}>
                {shownRecent.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={s.row} aria-pressed={selectedId === p.id} onClick={() => setPick({ kind: 'place', place: p })}>
                      <span className={s.name}>{placeLabel(p)}</span>
                      <span className={s.badge}>{SOURCE_LABEL[p.source]}</span>
                      <span className={s.check} aria-hidden="true">{selectedId === p.id ? '✓' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {status === 'loading' && <p className={u.hint}>찾는 중…</p>}
          {searched && results.length > 0 && (
            <>
              <h3 className={s.groupTitle}>검색 결과</h3>
              <ul className={s.ul}>
                {results.map((r) => (
                  <li key={`${r.source}:${r.externalId}`}>
                    <button type="button" className={s.row} aria-pressed={isPickedResult(r)} onClick={() => setPick({ kind: 'result', result: r })}>
                      <span className={s.main}>
                        <span className={s.name}>{r.name}</span>
                        {r.sub && <span className={s.sub}>{r.sub}</span>}
                      </span>
                      <span className={s.badge}>{SOURCE_LABEL[r.source]}</span>
                      <span className={s.check} aria-hidden="true">{isPickedResult(r) ? '✓' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {empty && <p className={u.hint} role="status">{tab === 'domestic' ? '결과가 없어요. 해외 장소라면 해외 탭에서 찾아보세요.' : hasHangul(query) ? '결과가 없어요. 해외 장소는 영어나 현지어로 찾아보세요. 예: 도쿄돔 → Tokyo Dome' : '결과가 없어요. 다른 이름으로 찾아보세요.'}</p>}
          {err && <p className={u.error} role="alert">{err}</p>}
          {err && osmFallback && tab === 'domestic' && query && (
            <button type="button" className={u.ghost} style={{ alignSelf: 'flex-start' }} onClick={() => void run(query, 'overseas')}>OpenStreetMap으로 찾기</button>
          )}
          {tab === 'overseas' && !searched && status === 'idle' && query && <p className={u.hint}>입력하고 `검색`을 눌러 주세요.</p>}
        </div>

        {query && !linkMode && (
          <button type="button" className={u.dashed} onClick={() => void nameOnly()}>검색 없이 &lsquo;{query}&rsquo; 이름만 남기기</button>
        )}
        <p className={s.attr}>장소 검색: 카카오 / © OpenStreetMap 기여자</p>
        <div className={s.actions} style={linkMode ? { gridTemplateColumns: '1fr' } : undefined}>
          {!linkMode && <button type="button" className={s.remove} disabled={!value} onClick={() => onPick(null)}>장소 빼기</button>}
          <button type="button" className={u.primary} disabled={!pick} onClick={() => void confirm()}>{linkMode ? '이 장소로 연결' : '이 장소로'}</button>
        </div>
      </div>
    </Sheet>
  );
}
