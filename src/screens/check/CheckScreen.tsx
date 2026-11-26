import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import {
  addCheckItem, CheckError, checkedDates, listCheckItems, listPhotos, savePhoto, setCheckItemOn, setCover, setCoverWindow, toggleCheck,
} from '../../data/repo/checks';
import { listTargets } from '../../data/repo/lists';
import type { CheckItem } from '../../data/types';
import { Sheet } from '../../components/Sheet';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import { checkCounts, coverFit, coverFor, monthGrid, shiftMonth } from '../../domain/check';
import { monthOf, parseDateStr, today, WEEKDAY_NAMES } from '../../domain/date';
import { useLookups } from '../../hooks/useLookups';
import { usePhoto } from '../../hooks/usePhoto';
import { resizePhoto } from '../../services/photo';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Check.module.css';

/** 기록 › 체크 달력(STORYBOARD 4-1-1, U4-3·U4-4). */
export function CheckScreen() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const todayStr = today();
  const nowYm = monthOf(todayStr);
  const [ym, setYm] = useState(nowYm);
  const [sheet, setSheet] = useState<null | 'manage' | 'cover'>(null);
  const items = useLiveQuery(() => listCheckItems(getDb(), true), []);
  const l = useLookups();
  const cur = items?.find((x) => x.id === params.get('item')) ?? items?.[0];
  const dates = useLiveQuery(async () => (cur ? checkedDates(getDb(), cur.id) : new Set<string>()), [cur?.id]);
  const photo = usePhoto(coverFor(cur?.cover, ym));

  if (!items || !l || !dates) return null;

  const labelOf = (x: CheckItem) => `${l.targets.get(x.targetId)?.name ?? ''} · ${x.name}`;
  const colorOf = (x: CheckItem) => x.color ?? l.targets.get(x.targetId)?.color ?? 'var(--accent)';
  const pick = (id: string) => setParams({ item: id }, { replace: true });
  const { y, m } = parseDateStr(`${ym}-01`);
  const counts = checkCounts(dates, ym);

  const toggle = async (date: string) => {
    if (!cur) return;
    const on = await toggleCheck(getDb(), cur.id, date, todayStr);
    const { m: mm, d } = parseDateStr(date);
    toast(`${mm}월 ${d}일 ${on ? '체크했어요 ✓' : '체크를 지웠어요'}`);
  };

  const summary = cur && (
    <>
      <span className={s.sumMain}>
        <span className={s.sumLabel}>{labelOf(cur)} · {m}월</span>
        <span className={s.sumCount}>{counts.month}일 체크했어요</span>
      </span>
      <span className={s.sumSide}>
        <span>지난달 {counts.prevMonth}일</span>
        <span>{y}년 {counts.year}일</span>
      </span>
    </>
  );

  return (
    <div className={r.screen}>
      <div className={r.head}>
        <div className={r.crumbs}>
          <Link to="/" className={r.back} aria-label="뒤로">‹</Link>
          <h1 className={r.title} style={{ fontSize: '1.25rem' }}>체크 달력</h1>
        </div>
        <button type="button" className={u.ghost} onClick={() => setSheet('manage')}>항목 관리</button>
      </div>

      {items.length === 0 ? (
        <div className={s.empty}>
          <p className={u.hint}>대상마다 챙기고 싶은 걸 체크 항목으로 만들어요. 예: 버블, 위버스 DM, 라이브, 연재, 업로드.</p>
          <button type="button" className={u.dashed} onClick={() => setSheet('manage')}>+ 체크 항목 만들기</button>
        </div>
      ) : (
        <>
          <div className={s.tabs} role="tablist" aria-label="체크 항목">
            {items.map((x) => {
              const sel = x.id === cur?.id;
              const c = colorOf(x);
              return (
                <button key={x.id} type="button" role="tab" aria-selected={sel} className={s.tab} onClick={() => pick(x.id)}
                  style={sel ? { borderColor: c, background: `color-mix(in srgb, ${c} 14%, var(--bg))` } : undefined}>
                  <span className={s.dot} style={{ background: c }} aria-hidden="true" />{labelOf(x)}
                </button>
              );
            })}
          </div>

          {cur && (photo ? (
            <div className={s.cover} style={{ backgroundImage: `url(${photo.url})` }}>
              <span className={s.coverShade} aria-hidden="true" />
              <button type="button" className={s.coverBtn} onClick={() => setSheet('cover')}>표지 바꾸기</button>
              <div className={s.coverText}>{summary}</div>
            </div>
          ) : (
            <div className={s.plain} style={{ background: `color-mix(in srgb, ${colorOf(cur)} 12%, var(--bg))` }}>
              <div className={s.plainText}>{summary}</div>
              <button type="button" className={s.addCover} onClick={() => setSheet('cover')}>+ 달력 표지 사진 넣기</button>
            </div>
          ))}

          <div className={s.nav}>
            <button type="button" className={s.navBtn} aria-label="이전 달" onClick={() => setYm(shiftMonth(ym, -1))}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
            <span className={s.ym} aria-live="polite">{y}년 {m}월</span>
            <button type="button" className={s.navBtn} aria-label="다음 달" disabled={ym >= nowYm} onClick={() => setYm(shiftMonth(ym, 1))}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>

          {cur && <Calendar ym={ym} todayStr={todayStr} dates={dates} color={colorOf(cur)} photo={cur.cover?.bg ? photo : null} onToggle={(d) => void toggle(d)} />}
          <p className={u.hint}>날짜를 누르면 온 날로 체크하고, 다시 누르면 지워요. 오늘 이후 날짜는 체크할 수 없어요.</p>
          <div className={s.info}>
            <strong>자동으로 체크하기 (안드로이드 앱)</strong>
            <span>안드로이드 앱에서는 항목마다 고른 앱(예: 버블, 위버스)의 알림을 읽어 자동으로 체크하고, 하루에 몇 번 왔는지도 세요. 알림 접근을 허락했을 때만 작동하고, 메시지 내용은 저장하지 않아요. 지금(웹 앱)은 직접 체크해요.</span>
          </div>
        </>
      )}

      <ManageSheet open={sheet === 'manage'} onClose={() => setSheet(null)} onAdded={(it, label) => { pick(it.id); toast(`${label} 항목을 만들었어요`); }} />
      {cur && <CoverSheet open={sheet === 'cover'} onClose={() => setSheet(null)} item={cur} title={`${labelOf(cur)} 달력 표지`} ym={ym} />}
    </div>
  );
}

const WEEK_COLOR = (i: number) => (i === 0 ? 'var(--danger)' : i === 6 ? '#2563A8' : 'var(--text-sub)');

interface CalendarProps {
  ym: string;
  todayStr: string;
  dates: Set<string>;
  color: string;
  photo: { url: string; w: number; h: number } | null;
  onToggle: (date: string) => void;
}

/** 달력. 사진 창문 보기면 흐린 사진 위에 체크한 날 칸만 사진이 선명하게 보입니다. */
function Calendar({ ym, todayStr, dates, color, photo, onToggle }: CalendarProps) {
  const cells = monthGrid(ym);
  const box = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [geo, setGeo] = useState<{ w: number; h: number; cells: { x: number; y: number }[] }>({ w: 0, h: 0, cells: [] });

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    setGeo({ w: b.width, h: b.height, cells: cellRefs.current.map((c) => { const rc = c?.getBoundingClientRect(); return rc ? { x: rc.left - b.left, y: rc.top - b.top } : { x: 0, y: 0 }; }) });
  }, []);

  useLayoutEffect(() => {
    if (!photo) return;
    measure();
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo, ym, measure]);

  const fit = photo ? coverFit({ w: photo.w, h: photo.h }, { w: geo.w, h: geo.h }) : null;
  const bgSize = fit ? `${Math.round(fit.w)}px ${Math.round(fit.h)}px` : undefined;

  return (
    <div ref={box} className={`${s.cal} ${photo ? s.calPhoto : ''}`}>
      {photo && fit && (
        <>
          <span className={s.calBlur} aria-hidden="true" style={{ backgroundImage: `url(${photo.url})`, backgroundSize: bgSize, backgroundPosition: `${Math.round(fit.x + 14)}px ${Math.round(fit.y + 14)}px` }} />
          <span className={s.calVeil} aria-hidden="true" />
        </>
      )}
      <div className={s.grid} role="group" aria-label={`${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`}>
        {WEEKDAY_NAMES.map((w, i) => <span key={w} className={s.wd} style={{ color: WEEK_COLOR(i) }} aria-hidden="true">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} className={s.blank} />;
          const day = Number(d.slice(8));
          const on = dates.has(d);
          const future = d > todayStr;
          const isToday = d === todayStr;
          const dow = i % 7;
          const pos = geo.cells[i];
          const win: CSSProperties | undefined = photo && fit && pos && on
            ? { backgroundImage: `url(${photo.url})`, backgroundSize: bgSize, backgroundPosition: `${Math.round(fit.x - pos.x - 2)}px ${Math.round(fit.y - pos.y - 2)}px` }
            : undefined;
          return (
            <button
              key={d}
              ref={(el) => { cellRefs.current[i] = el; }}
              type="button"
              className={s.cell}
              disabled={future}
              aria-pressed={on}
              aria-label={`${Number(d.slice(5, 7))}월 ${day}일${isToday ? ' 오늘' : ''}${on ? ' 체크함' : ''}`}
              onClick={() => onToggle(d)}
            >
              {photo ? (
                on
                  ? <span className={s.win} style={win}><span className={s.winNum}>{day}</span></span>
                  : <span className={`${s.sq} ${isToday ? s.todaySq : ''}`} style={{ color: WEEK_COLOR(dow) === 'var(--text-sub)' ? undefined : WEEK_COLOR(dow), borderColor: isToday ? color : undefined }}>{day}</span>
              ) : (
                <span
                  className={`${s.circle} ${isToday && !on ? s.today : ''}`}
                  style={on ? { background: color, color: '#FFF', fontWeight: 700 } : { color: dow === 0 || dow === 6 ? WEEK_COLOR(dow) : undefined, borderColor: isToday ? color : undefined }}
                >{day}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ManageSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (item: CheckItem, label: string) => void }) {
  const items = useLiveQuery(() => listCheckItems(getDb()), []) ?? [];
  const targets = useLiveQuery(() => listTargets(getDb()), []) ?? [];
  const l = useLookups();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const tid = targetId ?? targets[0]?.id;

  const add = async () => {
    if (!tid) return;
    try {
      const it = await addCheckItem(getDb(), tid, name);
      setName('');
      setErr(null);
      onAdded(it, `${l?.targets.get(tid)?.name ?? ''} · ${it.name}`);
    } catch (e) {
      if (e instanceof CheckError) setErr(e.reason === 'empty' ? '이름을 넣어 주세요.' : e.reason === 'duplicate' ? '이미 있는 항목이에요.' : '대상을 다시 골라 주세요.');
      else throw e;
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="체크 항목">
      <div className={s.sheetBody}>
        <p className={u.hint}>대상마다 챙기고 싶은 걸 이름 붙여 만들어요. 켠 항목만 기록 탭의 &apos;오늘 체크&apos;와 이 달력에 나와요.</p>
        {items.length > 0 && (
          <ul className={s.manage} aria-label="체크 항목 목록">
            {items.map((x) => {
              const t = l?.targets.get(x.targetId);
              const label = `${t?.name ?? ''} · ${x.name}`;
              return (
                <li key={x.id} className={s.manageRow}>
                  <span className={s.dot} style={{ background: x.color ?? t?.color }} aria-hidden="true" />
                  <span className={s.manageName}>{label}</span>
                  <Switch checked={x.on} onChange={(on) => void setCheckItemOn(getDb(), x.id, on)} label={`${label} 체크`} />
                </li>
              );
            })}
          </ul>
        )}
        <div className={s.newBox}>
          <strong className={s.newTitle}>새 체크 항목</strong>
          <div className={u.chips} role="radiogroup" aria-label="대상">
            {targets.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={t.id === tid} className={`${u.chip} ${t.id === tid ? u.chipOn : ''}`} onClick={() => setTargetId(t.id)}>
                <span className={s.dot} style={{ background: t.color }} aria-hidden="true" /> {t.name}
              </button>
            ))}
          </div>
          <div className={s.newRow}>
            <input className={u.input} style={{ flex: 1, minWidth: 0 }} aria-label="체크 항목 이름" placeholder="예: 버블, 라이브, 연재" maxLength={30} value={name}
              onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
            <button type="button" className={u.primary} onClick={() => void add()}>추가</button>
          </div>
          {err && <p className={u.error} role="alert">{err}</p>}
        </div>
      </div>
    </Sheet>
  );
}

function PhotoOption({ id, selected, onPick }: { id: string; selected: boolean; onPick: () => void }) {
  const p = usePhoto(id);
  return (
    <button type="button" className={`${s.opt} ${selected ? s.optOn : ''}`} aria-label="넣은 사진" aria-pressed={selected} onClick={onPick}
      style={p ? { backgroundImage: `url(${p.url})` } : undefined} />
  );
}

function CoverSheet({ open, onClose, item, title, ym }: { open: boolean; onClose: () => void; item: CheckItem; title: string; ym: string }) {
  const toast = useToast();
  const photos = useLiveQuery(() => listPhotos(getDb()), []) ?? [];
  const [scope, setScope] = useState<'all' | 'month'>('all');
  const m = Number(ym.slice(5));
  const current = scope === 'month' ? coverFor(item.cover, ym) : item.cover?.all ?? null;

  const choose = async (id: string | null) => {
    await setCover(getDb(), item.id, id, scope, ym);
    toast(id ? (scope === 'month' ? `${m}월 표지를 바꿨어요` : '표지를 바꿨어요') : '표지를 뺐어요');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { blob, width, height } = await resizePhoto(file);
      const id = await savePhoto(getDb(), blob, width, height, file.name);
      await setCover(getDb(), item.id, id, scope, ym);
      toast('표지 사진을 넣었어요');
    } catch {
      toast('이 사진은 읽을 수 없어요');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className={s.sheetBody}>
        <div className={s.seg} role="radiogroup" aria-label="적용 범위">
          {(['all', 'month'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} className={`${s.segBtn} ${scope === k ? s.segOn : ''}`} onClick={() => setScope(k)}>
              {k === 'all' ? '모든 달' : `${m}월만`}
            </button>
          ))}
        </div>
        <div className={s.opts}>
          <button type="button" className={`${s.opt} ${current === null ? s.optOn : ''}`} aria-pressed={current === null} onClick={() => void choose(null)}>없음</button>
          {photos.map((p) => <PhotoOption key={p.id} id={p.id} selected={current === p.id} onPick={() => void choose(p.id)} />)}
          <label className={s.addPhoto}>
            + 사진 넣기
            <input type="file" accept="image/*" className="sr-only" aria-label="사진 넣기" onChange={(e) => void onFile(e)} />
          </label>
        </div>
        <div className={s.winRow}>
          <span className={s.winText}>
            <span>사진 창문으로 보기</span>
            <span className={s.winSub}>온 날 칸에만 사진이 보여요. 끄면 깔끔한 달력이에요.</span>
          </span>
          <Switch checked={item.cover?.bg ?? true} onChange={(v) => void setCoverWindow(getDb(), item.id, v)} label="사진 창문으로 보기" />
        </div>
        <p className={u.hint}>사진은 줄여서 폰 안에만 저장하고, 촬영 위치 정보는 남기지 않아요.</p>
      </div>
    </Sheet>
  );
}
