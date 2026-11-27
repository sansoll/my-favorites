import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { linkNamePlace, mapUrl, mergePlaces, placeLabel, renamePlace } from '../../data/repo/places';
import type { Visit } from '../../domain/stats';
import { computeVisits, type VisitSort } from '../../domain/stats';
import { formatMonthDay, today } from '../../domain/date';
import { formatWon } from '../../domain/money';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { NameSheet } from '../../components/NameSheet';
import { Sheet } from '../../components/Sheet';
import { PlaceSheet } from '../../components/PlaceSheet';
import { useToast } from '../../components/Toast';
import { recordPath, useLookups } from '../../hooks/useLookups';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Visited.module.css';
import { useVisitCoords } from './useVisitCoords';
import type { MapPoint } from './VisitMap';

const VisitMap = lazy(() => import('./VisitMap'));

const SORTS: Record<VisitSort, string> = { count: '많이 간 순', recent: '최근 순', spend: '많이 쓴 순' };
const SOURCE = { kakao: '카카오', osm: 'OSM', name: '이름만' } as const;

/** 다녀온 곳(STORYBOARD 6-2, U6-4). */
export function VisitedScreen() {
  const toast = useToast();
  const year = Number(today().slice(0, 4));
  const [scope, setScope] = useState<'year' | 'all'>('year');
  const [sort, setSort] = useState<VisitSort>('count');
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Visit | null>(null);
  const [linking, setLinking] = useState<Visit | null>(null);
  const [merging, setMerging] = useState<Visit | null>(null);
  const [mergeInto, setMergeInto] = useState<Visit | null>(null);
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [records, places] = await Promise.all([db.records.toArray(), db.places.toArray()]);
    return { records, places: new Map(places.map((p) => [p.id, p])) };
  }, []);
  const l = useLookups();
  const visits = useMemo(() => (data ? computeVisits(data.records, data.places, scope === 'year' ? year : null, sort) : []), [data, scope, year, sort]);
  const visitPlaces = useMemo(() => visits.map((v) => v.place), [visits]);
  const { coords, loading } = useVisitCoords(visitPlaces);
  const coordSig = visits.map((v) => { const c = coords.get(v.place.id); return c ? `${v.place.id}@${c.lat},${c.lng}#${v.count}` : ''; }).join('|');
  const points = useMemo<MapPoint[]>(() => visits.flatMap((v, i) => {
    const c = coords.get(v.place.id);
    return c ? [{ id: v.place.id, lat: c.lat, lng: c.lng, count: v.count, label: placeLabel(v.place), rank: i + 1 }] : [];
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [coordSig]);
  if (!data || !l) return null;
  const totalVisits = visits.reduce((n, v) => n + v.count, 0);
  const allVisits = merging ? computeVisits(data.records, data.places, null, 'count').filter((v) => v.place.id !== merging.place.id) : [];
  const doMerge = async () => {
    if (!merging || !mergeInto) return;
    await mergePlaces(getDb(), merging.place.id, mergeInto.place.id);
    setOpen(mergeInto.place.id);
    setMerging(null); setMergeInto(null);
    toast('같은 곳으로 합쳤어요');
  };
  const offMap = visits.length - points.length;
  const selectFromMap = (id: string) => {
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`visit-${id}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  };

  return (
    <div className={r.screen}>
      <div className={r.head}>
        <div className={r.crumbs}>
          <Link to="/stats" className={r.back} aria-label="뒤로">‹</Link>
          <h1 className={r.title} style={{ fontSize: '1.25rem' }}>다녀온 곳</h1>
        </div>
        <div className={s.seg} role="radiogroup" aria-label="기간">
          {(['year', 'all'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} className={`${s.segBtn} ${scope === k ? s.segOn : ''}`} onClick={() => setScope(k)}>{k === 'year' ? '올해' : '전체'}</button>
          ))}
        </div>
      </div>
      <p className={s.summary}>{scope === 'year' ? `${year}년에` : '지금까지'} <strong>{visits.length}곳 · {totalVisits}번</strong> 다녀왔어요</p>
      <div className={s.mapBox}>
        <Suspense fallback={null}>
          <VisitMap points={points} selectedId={open} onSelect={selectFromMap} />
        </Suspense>
        {visits.length > 0 && (loading || offMap > 0) && (
          <p className={s.mapNote} role="status">{loading ? '지도에 찍는 중…' : `${offMap}곳은 지도에 없어요(이름만 남긴 곳 등)`}</p>
        )}
      </div>
      <div className={u.chips} role="radiogroup" aria-label="정렬">
        {(Object.keys(SORTS) as VisitSort[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={sort === k} className={`${u.chip} ${sort === k ? u.chipOn : ''}`} onClick={() => setSort(k)}>{SORTS[k]}</button>
        ))}
      </div>
      {visits.length === 0 ? (
        <p className={u.hint}>장소를 남긴 기록이 아직 없어요. 금액 화면에서 `장소`를 고르면 여기에 모여요.</p>
      ) : (
        <ol className={s.list}>
          {visits.map((v, i) => {
            const isOpen = open === v.place.id;
            const name = placeLabel(v.place);
            return (
              <li key={v.place.id} id={`visit-${v.place.id}`} className={s.item}>
                <button type="button" className={s.row} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.place.id)}>
                  <span className={s.rank}>{i + 1}</span>
                  <span className={s.name}>{name}</span>
                  <span className={s.badge}>{SOURCE[v.place.source]}</span>
                  {!loading && !coords.has(v.place.id) && <span className={s.off}>지도 없음</span>}
                  <span className={s.count}>{v.count}번</span>
                  <span aria-hidden="true" className={s.caret}>{isOpen ? '▴' : '▾'}</span>
                </button>
                {isOpen && (
                  <div className={s.detail}>
                    <p className={s.meta}>
                      {v.targetIds.map((id) => { const t = l.targets.get(id); return <span key={id} className={s.who}><span className={s.dot} style={{ background: t?.color }} aria-hidden="true" />{t?.name}</span>; })}
                      <span>· 마지막 {formatMonthDay(v.last)}</span>
                      <strong className={s.spend}>{formatWon(v.spend)}</strong>
                    </p>
                    <ul className={s.recs} aria-label={`${name} 기록`}>
                      {v.records.map((x) => (
                        <li key={x.id}>
                          <Link to={`/records/${x.id}`} className={s.rec}>
                            <span className={s.recDate}>{formatMonthDay(x.date)}</span>
                            <span className={s.recPath}>{l.targets.get(x.targetId)?.name} · {recordPath(l, x)}</span>
                            <span className={s.recAmt}>{formatWon(x.paid - x.refund)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className={s.actions}>
                      <a className={s.action} href={mapUrl(v.place)} target="_blank" rel="noopener noreferrer">{v.place.source === 'kakao' ? '카카오맵에서 열기' : '구글 지도에서 열기'}</a>
                      <button type="button" className={s.action} onClick={() => setRenaming(v)}>이름 바꾸기</button>
                      {v.place.source === 'name' && <button type="button" className={s.action} onClick={() => setLinking(v)}>장소 연결하기</button>}
                      <button type="button" className={s.action} onClick={() => setMerging(v)}>같은 곳 합치기</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <NameSheet
        open={!!renaming}
        title="보이는 이름 바꾸기"
        initial={renaming ? placeLabel(renaming.place) : ''}
        submitLabel="바꾸기"
        onClose={() => setRenaming(null)}
        onSubmit={async (n) => {
          if (!renaming) return null;
          try { await renamePlace(getDb(), renaming.place.id, n); } catch { return 'empty'; }
          setRenaming(null);
          toast('이름을 바꿨어요');
          return null;
        }}
      >
        {renaming && renaming.place.source !== 'name' && <p className={u.hint}>검색 이름({renaming.place.name})은 그대로 두고 보이는 이름만 바꿔요. 비우면 원래 이름으로 돌아가요.</p>}
      </NameSheet>
      <Sheet open={!!merging && !mergeInto} onClose={() => setMerging(null)} title="같은 곳 합치기" kicker={merging ? `${placeLabel(merging.place)}의 기록을 옮길 곳` : undefined}>
        <p className={u.hint}>카카오와 해외 검색으로 따로 넣은 같은 장소를 하나로 모아요. 고른 곳으로 기록이 옮겨지고, 지금 장소는 목록에서 사라져요.</p>
        {allVisits.length === 0 ? <p className={u.hint}>합칠 다른 장소가 없어요.</p> : (
          <ul className={s.recs} aria-label="합칠 장소">
            {allVisits.map((x) => (
              <li key={x.place.id}>
                <button type="button" className={s.row} onClick={() => setMergeInto(x)}>
                  <span className={s.name}>{placeLabel(x.place)}</span>
                  <span className={s.badge}>{SOURCE[x.place.source]}</span>
                  <span className={s.count}>{x.count}번</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!merging && !!mergeInto}
        title="같은 곳으로 합칠까요?"
        body={merging && mergeInto ? `‘${placeLabel(merging.place)}’ 기록을 ‘${placeLabel(mergeInto.place)}’(으)로 옮기고, ‘${placeLabel(merging.place)}’는 지워요.` : undefined}
        confirmLabel="합치기"
        danger={false}
        onConfirm={() => void doMerge()}
        onCancel={() => setMergeInto(null)}
      />
      <PlaceSheet open={!!linking} onClose={() => setLinking(null)} onPick={() => setLinking(null)}
        linkMode={{ onResult: async (res) => { if (!linking) return; await linkNamePlace(getDb(), linking.place.id, res); setLinking(null); setOpen(null); toast('장소를 연결했어요'); } }} />
    </div>
  );
}
