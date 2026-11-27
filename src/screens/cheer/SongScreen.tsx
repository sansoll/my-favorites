import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { getSetting, setSetting } from '../../data/settings';
import type { Song, SongExtra } from '../../data/types';
import {
  addExtra, addLink, deleteSong, paintWord, recordOpen, removeExtra, removeLink, resetLayer, SongError, updateExtra, updateLyrics,
} from '../../data/repo/songs';
import {
  allCoverKeys, CHEER_COLOR_KEY, DEFAULT_CHEER_COLOR, extraKey, extrasAt, extraShow, markKey, markShow, splitLyrics, stageColor, VIEW_LABELS, type ViewMode,
} from '../../domain/cheer';
import { withEulReul } from '../../domain/name';
import { safeUrl } from '../../domain/url';
import { keepScreenOn } from '../../services/wakeLock';
import { TargetBanner } from '../../components/TargetPhoto';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import u from '../../components/ui.module.css';
import s from './Cheer.module.css';

const MODE_KEY = 'cheerViewMode';
type Pos = SongExtra['position'];
const POS_LABEL: Record<Pos, string> = { before: '단어 앞', after: '단어 뒤', below: '줄 아래' };

type ExtraTarget =
  | { kind: 'new'; line: number; word: number; text: string; pos: Pos }
  | { kind: 'edit'; extra: SongExtra };

/** 곡 상세(STORYBOARD 7-2, 7-3): 보기 세 가지, 편집 모드, 공연장 모드. */
export function SongScreen() {
  const { id = '' } = useParams();
  const song = useLiveQuery(() => getDb().songs.get(id), [id]);
  const target = useLiveQuery(async () => (song ? getDb().targets.get(song.targetId) : undefined), [song?.targetId]);
  if (song === undefined) return null;
  if (!song) return <div className={s.body}><p className={u.hint}>곡을 찾을 수 없어요.</p><Link to="/cheer">곡 목록으로</Link></div>;
  return <SongView key={song.id} song={song} who={target?.name ?? ''} photoId={target?.photoId} />;
}

function SongView({ song, who, photoId }: { song: Song; who: string; photoId?: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mode, setModeState] = useState<ViewMode>('cheer');
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState(params.get('edit') === '1');
  const [tool, setTool] = useState<'paint' | 'insert'>('paint');
  const color = useLiveQuery(() => getSetting<string>(getDb(), CHEER_COLOR_KEY, DEFAULT_CHEER_COLOR), []) ?? DEFAULT_CHEER_COLOR;
  const [extraT, setExtraT] = useState<ExtraTarget | null>(null);
  const [draft, setDraft] = useState('');
  const [lyricOpen, setLyricOpen] = useState(false);
  const [lyricDraft, setLyricDraft] = useState('');
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const [stage, setStage] = useState(false);
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    // 새 곡은 편집 모드로 열지만, 주소에는 남기지 않습니다(다시 열면 보기 모드).
    if (params.get('edit')) setParams({}, { replace: true });
    void recordOpen(getDb(), song.id);
    void getSetting<ViewMode>(getDb(), MODE_KEY, 'cheer').then((m) => setModeState(m));
  }, [song.id]);

  const setMode = (m: ViewMode) => { setModeState(m); setOpened(new Set()); void setSetting(getDb(), MODE_KEY, m); };
  const flip = (key: string) => setOpened((o) => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const lines = splitLyrics(song.lyrics);
  const layer = song.layer;
  const markAt = (line: number, word: number) => layer.marks.find((m) => m.line === line && m.word === word);

  const tapWord = (line: number, word: number, text: string) => {
    if (tool === 'paint') {
      // 칠한 단어를 다시 누르면 지움(예전 색이어도), 안 칠한 단어는 설정한 색으로
      void paintWord(getDb(), song.id, line, word, markAt(line, word) ? null : color);
      setChanged((c) => { if (!c.has(line)) return c; const n = new Set(c); n.delete(line); return n; });
    } else {
      setDraft('');
      setExtraT({ kind: 'new', line, word, text, pos: 'after' });
    }
  };

  const renderExtra = (x: SongExtra, block = false): ReactNode => {
    const label = `「${x.text}」`;
    if (edit) {
      return <button key={x.id} type="button" className={s.extra} style={{ background: x.color }} aria-label={`추가 응원 ${x.text} 고치기`} onClick={() => { setDraft(x.text); setExtraT({ kind: 'edit', extra: x }); }}>{block ? `「 ${x.text} 」` : label}</button>;
    }
    const show = extraShow(mode, opened.has(extraKey(x.id)));
    if (show === 'hidden') return null;
    if (show === 'covered') return <button key={x.id} type="button" className={`${s.extra} ${s.covered}`} aria-label="가린 추가 응원 열기" onClick={() => flip(extraKey(x.id))}>{label}</button>;
    if (mode === 'memo') return <button key={x.id} type="button" className={s.extra} style={{ background: x.color }} onClick={() => flip(extraKey(x.id))}>{label}</button>;
    return <span key={x.id} className={s.extra} style={{ background: x.color }}>{block ? `「 ${x.text} 」` : label}</span>;
  };

  /** 칠한 단어는 배경이 밝은 색이라 다크 모드에서도 글자를 어둡게 둡니다. */
  const painted = (bg: string) => ({ background: bg, color: '#1B1B1F' });
  const renderWord = (line: number, wi: number, w: string): ReactNode => {
    const mk = markAt(line, wi);
    if (edit) {
      return <button key={`w${wi}`} type="button" className={`${s.word} ${s.editable}`} style={mk ? painted(mk.color) : undefined} aria-pressed={!!mk} onClick={() => tapWord(line, wi, w)}>{w}</button>;
    }
    if (!mk) return <span key={`w${wi}`} className={s.word}>{w}</span>;
    const key = markKey(line, wi);
    const show = markShow(mode, opened.has(key));
    if (show === 'plain') return <span key={`w${wi}`} className={s.word}>{w}</span>;
    if (show === 'covered') return <button key={`w${wi}`} type="button" className={`${s.word} ${s.covered}`} aria-label="가린 단어 열기" onClick={() => flip(key)}>{w}</button>;
    if (mode === 'memo') return <button key={`w${wi}`} type="button" className={s.word} style={painted(mk.color)} onClick={() => flip(key)}>{w}</button>;
    return <mark key={`w${wi}`} className={s.word} style={painted(mk.color)}>{w}</mark>;
  };

  const saveExtra = async () => {
    if (!extraT || !draft.trim()) return;
    if (extraT.kind === 'new') {
      await addExtra(getDb(), song.id, { line: extraT.line, word: extraT.word, position: extraT.pos, text: draft, color });
      toast(extraT.pos === 'below' ? '줄 아래에 추가 응원을 넣었어요' : `${extraT.text} ${extraT.pos === 'before' ? '앞에' : '뒤에'} 추가 응원을 넣었어요`);
    } else {
      await updateExtra(getDb(), song.id, extraT.extra.id, draft);
      toast('추가 응원을 고쳤어요');
    }
    setExtraT(null);
  };

  const saveLyrics = async () => {
    try {
      const r = await updateLyrics(getDb(), song.id, lyricDraft);
      setChanged(new Set(r.changed));
      setLyricOpen(false);
      toast(r.changed.length ? `가사를 저장했어요. 고친 줄 ${r.changed.length}개는 응원법을 다시 표시해 주세요` : '가사를 저장했어요');
    } catch (e) {
      if (e instanceof SongError) toast('가사를 비울 수는 없어요');
    }
  };

  const draftShow = draft.trim() || '구호';
  const preview = extraT?.kind === 'new'
    ? extraT.pos === 'before' ? `「${draftShow}」 ${extraT.text} …` : extraT.pos === 'after' ? `… ${extraT.text} 「${draftShow}」` : `… ${extraT.text} …\n「 ${draftShow} 」`
    : '';

  return (
    <div className={s.screen}>
      <div className={s.top}>
        {!edit && <TargetBanner photoId={photoId} name={who} />}
        <div className={s.topRow}>
          <div className={s.heading}>
            <Link to="/cheer" className={s.back} aria-label="곡 목록으로">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
            </Link>
            <div>
              <span className={s.who}>{who}</span>
              <h1 className={s.songH1}>{song.title}</h1>
            </div>
          </div>
          <button type="button" className={`${s.editBtn} ${edit ? s.editOn : ''}`} onClick={() => { if (edit) toast('응원법을 저장했어요'); setEdit(!edit); setTool('paint'); }}>{edit ? '완료' : '편집'}</button>
        </div>
        {!edit ? (
          <>
            <div className={s.seg} role="radiogroup" aria-label="보기 모드">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} className={`${s.segBtn} ${mode === m ? s.segOn : ''}`} onClick={() => setMode(m)}>{VIEW_LABELS[m]}</button>
              ))}
            </div>
            {mode === 'memo' && (
              <div className={s.memoBar}>
                <button type="button" className={s.pill} onClick={() => setOpened(new Set(allCoverKeys(layer)))}>모두 보기</button>
                <button type="button" className={s.pill} onClick={() => setOpened(new Set())}>모두 가리기</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={s.seg} role="radiogroup" aria-label="편집 도구">
              <button type="button" role="radio" aria-checked={tool === 'paint'} className={`${s.segBtn} ${tool === 'paint' ? s.segOn : ''}`} onClick={() => setTool('paint')}>떼창 색칠</button>
              <button type="button" role="radio" aria-checked={tool === 'insert'} className={`${s.segBtn} ${tool === 'insert' ? s.segOn : ''}`} onClick={() => setTool('insert')}>추가 응원 넣기</button>
            </div>
            <p className={s.editHint}>
              {tool === 'paint' ? '단어를 누르면 칠하고, 다시 누르면 지워요.' : '구호를 넣을 단어를 누르세요. 넣은 구호를 누르면 고쳐요.'}
            </p>
          </>
        )}
      </div>

      <div className={s.body}>
        <div className={s.lyrics} aria-label="가사">
          {lines.map((l) => {
            const at = extrasAt(layer, l.index);
            return (
              <div key={l.index}>
                <div className={`${s.line} ${changed.has(l.index) ? s.lineChanged : ''}`} data-changed={changed.has(l.index) || undefined}>
                  {l.words.map((w, wi) => [
                    ...at.before(wi).map((x) => renderExtra(x)),
                    renderWord(l.index, wi, w),
                    ...at.after(wi).map((x) => renderExtra(x)),
                  ])}
                </div>
                {at.below.map((x) => {
                  const node = renderExtra(x, true);
                  return node && <div key={x.id} className={s.extraLine}>{node}</div>;
                })}
              </div>
            );
          })}
        </div>

        <Links song={song} edit={edit} />
      </div>

      <div className={s.bottom}>
        {!edit ? (
          <>
            <button type="button" className={s.stageBtn} disabled={mode !== 'cheer'} onClick={() => setStage(true)}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" /></svg>
              공연장 모드
            </button>
            {mode !== 'cheer' && <span className={s.stageNote}>공연장 모드는 응원법 보기에서만 쓸 수 있어요</span>}
          </>
        ) : (
          <div className={s.editBar}>
            <button type="button" className={s.barBtn} onClick={() => { setLyricDraft(song.lyrics); setLyricOpen(true); }}>가사 수정</button>
            <button type="button" className={`${s.barBtn} ${s.barDanger}`} onClick={() => setConfirm('reset')}>초기화</button>
            <button type="button" className={`${s.barBtn} ${s.barSolid}`} onClick={() => setConfirm('delete')}>곡 삭제</button>
          </div>
        )}
      </div>

      {stage && <Stage song={song} who={who} onClose={() => setStage(false)} />}

      <Sheet open={extraT !== null} onClose={() => setExtraT(null)} title={extraT?.kind === 'edit' ? '추가 응원 고치기' : '추가 응원 넣기'} kicker={extraT?.kind === 'new' ? `"${extraT.text}" 기준` : undefined}>
        <div className={s.form}>
          {extraT?.kind === 'new' && (
            <>
              <div className={s.seg} role="radiogroup" aria-label="넣을 위치">
                {(Object.keys(POS_LABEL) as Pos[]).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={extraT.pos === p} className={`${s.segBtn} ${extraT.pos === p ? s.segOn : ''}`} onClick={() => setExtraT({ ...extraT, pos: p })}>{POS_LABEL[p]}</button>
                ))}
              </div>
              <div className={s.preview} aria-label="미리보기">{preview}</div>
            </>
          )}
          <label className={u.field}>
            <span className={u.label}>구호</span>
            <input className={u.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="예: 하나 둘 셋" maxLength={200} />
          </label>
          <button type="button" className={u.primary} disabled={!draft.trim()} onClick={() => void saveExtra()}>{extraT?.kind === 'edit' ? '고치기' : '넣기'}</button>
          {extraT?.kind === 'edit' && (
            <button type="button" className={s.dangerOutline} onClick={() => { void removeExtra(getDb(), song.id, extraT.extra.id); setExtraT(null); toast('추가 응원을 지웠어요'); }}>이 추가 응원 지우기</button>
          )}
        </div>
      </Sheet>

      <Sheet open={lyricOpen} onClose={() => setLyricOpen(false)} title="가사 수정" kicker={song.title}>
        <div className={s.form}>
          <label className={u.field}>
            <span className={u.label}>원본 가사 · 한 줄에 한 소절</span>
            <textarea className={s.textarea} rows={10} value={lyricDraft} onChange={(e) => setLyricDraft(e.target.value)} />
          </label>
          <p className={u.hint}>고치지 않은 줄의 응원법은 그대로 남아요. 고친 줄은 응원법 표시를 다시 해야 해요.</p>
          <button type="button" className={u.primary} disabled={!lyricDraft.trim()} onClick={() => void saveLyrics()}>가사 저장</button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="응원법을 초기화할까요?"
        body="떼창 표시와 추가 응원이 모두 지워져요. 원본 가사는 그대로 남아요."
        confirmLabel="초기화"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); void resetLayer(getDb(), song.id).then(() => toast('응원법을 초기화했어요')); }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`${withEulReul(song.title)} 삭제할까요?`}
        body="가사와 응원법이 모두 지워져요."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void deleteSong(getDb(), song.id).then(() => { toast(`${withEulReul(song.title)} 삭제했어요`); navigate('/cheer'); });
        }}
      />
    </div>
  );
}

function Links({ song, edit }: { song: Song; edit: boolean }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const links = song.links.map((l, i) => ({ ...l, i, safe: safeUrl(l.url) })).filter((l) => l.safe);
  if (!edit && links.length === 0) return null;
  const add = async () => {
    try {
      await addLink(getDb(), song.id, name, url);
      setName(''); setUrl(''); setErr(null);
    } catch {
      setErr('http:// 나 https:// 로 시작하는 주소만 넣을 수 있어요.');
    }
  };
  return (
    <section className={s.links} aria-label="링크">
      <h2 className={s.linksTitle}>링크</h2>
      {links.map((l) => (edit ? (
        <div key={l.i} className={s.linkRow}>
          <span className={s.link}>{l.name}</span>
          <button type="button" className={s.pill} aria-label={`${l.name} 링크 빼기`} onClick={() => void removeLink(getDb(), song.id, l.i)}>✕</button>
        </div>
      ) : (
        <a key={l.i} className={s.link} href={l.safe!} target="_blank" rel="noopener noreferrer">▸ {l.name}</a>
      )))}
      {edit && (
        <div className={s.linkForm}>
          <input className={u.input} aria-label="링크 이름" placeholder="이름 (예: 응원법 영상)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <input className={u.input} aria-label="링크 주소" placeholder="https://" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} />
          {err && <p className={u.error} role="alert">{err}</p>}
          <button type="button" className={u.ghost} disabled={!url.trim()} onClick={() => void add()}>+ 링크 추가</button>
        </div>
      )}
    </section>
  );
}

/** 공연장 모드(U8-6): 큰 글자, 어두운 화면, 화면 꺼짐 방지(지원할 때). 응원법 보기 그대로 보여 줍니다. */
function Stage({ song, who, onClose }: { song: Song; who: string; onClose: () => void }) {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    let release: (() => void) | null = null;
    let alive = true;
    void keepScreenOn().then((r) => { if (alive) { release = r; setAwake(!!r); } else r?.(); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { alive = false; release?.(); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const lines = splitLyrics(song.lyrics);
  const part = (key: string, text: string, color?: string, bold = false) => (
    <span key={key} className={s.stagePart} style={color ? { background: stageColor(color), color: '#16161C', fontWeight: bold ? 700 : undefined } : undefined}>{text} </span>
  );
  return (
    <div className={s.stage} role="dialog" aria-modal="true" aria-label="공연장 모드">
      <div className={s.stageHead}>
        <div><span className={s.stageWho}>{who} · 공연장 모드</span><h2 className={s.stageTitle}>{song.title}</h2></div>
        <button type="button" className={s.stageClose} onClick={onClose}>닫기</button>
      </div>
      <div className={s.stageInfo}>
        <span className={s.stageDot} aria-hidden="true" style={awake ? undefined : { background: '#A9A9B4' }} />
        {awake ? '보는 동안 화면이 꺼지지 않아요' : '이 브라우저는 화면 꺼짐 방지를 지원하지 않아요'}
      </div>
      <div className={s.stageBody}>
        {lines.map((l) => {
          const at = extrasAt(song.layer, l.index);
          return (
            <div key={l.index}>
              <div>
                {l.words.map((w, wi) => {
                  const mk = song.layer.marks.find((m) => m.line === l.index && m.word === wi);
                  return [
                    ...at.before(wi).map((x) => part(x.id, `「${x.text}」`, x.color, true)),
                    part(`w${wi}`, w, mk?.color),
                    ...at.after(wi).map((x) => part(x.id, `「${x.text}」`, x.color, true)),
                  ];
                })}
              </div>
              {at.below.map((x) => <div key={x.id}>{part(x.id, `「 ${x.text} 」`, x.color, true)}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
