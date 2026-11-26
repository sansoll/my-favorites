import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { listTargets, listCategories } from '../../data/repo/lists';
import {
  activeFontId, activeTheme, activeThemeId, addFont, applyThemeById, categoryColorMap, deleteFont, deleteTheme, FontError, listFonts, listThemes,
  setCategoryColor, setFont, setTargetColor, setTargetPhoto, setThemeText, type ThemeEntry,
} from '../../data/repo/theme';
import { savePhoto } from '../../data/repo/checks';
import { nameKey, withEulReul } from '../../domain/name';
import { TARGET_COLORS, ETC_COLOR } from '../../domain/colors';
import { BLACK, READABILITY_LABEL, readability, resolveTheme, WHITE } from '../../theme/color';
import { applyTheme } from '../../theme/themes';
import { loadFont } from '../../app/ThemeApplier';
import { resizePhoto } from '../../services/photo';
import { usePhoto } from '../../hooks/usePhoto';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import type { Target } from '../../data/types';
import { PhotoThemeEditor } from './PhotoThemeEditor';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Theme.module.css';

const TEXT_CHOICES: { label: string; value: string }[] = [
  { label: '자동 (추천)', value: 'auto' },
  { label: '검정', value: BLACK },
  { label: '흰색', value: WHITE },
  { label: '진한 회색', value: '#45464E' },
];
const COLOR_CHOICES = [...TARGET_COLORS, ETC_COLOR];

function textLabel(t: ThemeEntry): string {
  const resolved = resolveTheme(t).text;
  const name = resolved === BLACK ? '검정' : resolved === WHITE ? '흰색' : '직접 고름';
  return t.text === 'auto' ? `자동 · ${name}` : name;
}

/** 테마와 꾸미기(STORYBOARD 9, U9-4~6) */
export function ThemeScreen() {
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [themes, activeId, fonts, fontId, targets, ccolors] = await Promise.all([listThemes(db), activeThemeId(db), listFonts(db), activeFontId(db), listTargets(db), categoryColorMap(db)]);
    const cats = new Map<string, string>();
    for (const t of targets) for (const c of await listCategories(db, t.id)) if (!cats.has(nameKey(c.name))) cats.set(nameKey(c.name), c.name);
    return { themes, activeId, fonts, fontId, targets, ccolors, cats: [...cats.entries()] };
  }, []);
  const [selId, setSelId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'text' | 'font' | { target: Target } | { cat: [string, string] } | null>(null);
  const [editor, setEditor] = useState(false);
  const [fontErr, setFontErr] = useState<string | null>(null);

  const sel = data ? (data.themes.find((t) => t.id === (selId ?? data.activeId)) ?? data.themes[0]) : null;

  // 고른 테마를 미리 보여 주고, 화면을 떠나면 쓰던 테마로 되돌립니다.
  useEffect(() => { if (sel) applyTheme(resolveTheme(sel)); }, [sel]);
  useEffect(() => () => { void activeTheme(getDb()).then((t) => applyTheme(resolveTheme(t))); }, []);

  const fontFamilies = useFontFamilies(data?.fonts.map((f) => f.id) ?? []);

  if (!data || !sel) return null;
  if (editor) return <PhotoThemeEditor onClose={() => setEditor(false)} onApplied={(name) => { setSelId(null); setEditor(false); toast(`${withEulReul(name)} 적용했어요`); }} />;

  const resolved = resolveTheme(sel);
  const level = readability(resolved.ratio);
  const using = sel.id === data.activeId;

  const pickFont = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const f = await addFont(getDb(), file);
      if (!(await loadFont(f.id)) && typeof FontFace !== 'undefined') {
        await deleteFont(getDb(), f.id);
        throw new FontError('broken');
      }
      await setFont(getDb(), f.id);
      setFontErr(null);
      toast(`${f.name} 글꼴을 적용했어요`);
    } catch (err) {
      const reason = err instanceof FontError ? err.reason : 'broken';
      setFontErr(reason === 'size' ? '20MB 이하 글꼴만 넣을 수 있어요.' : reason === 'type' ? '글꼴 파일(.ttf, .otf, .woff, .woff2)만 넣을 수 있어요.' : '글꼴 파일을 읽을 수 없어요.');
    }
  };

  const fontName = data.fonts.find((f) => f.id === data.fontId)?.name ?? '기본 글꼴';

  return (
    <div className={r.screen}>
      <div className={r.head}>
        <div className={r.crumbs}>
          <Link to="/settings" className={r.back} aria-label="뒤로">‹</Link>
          <h1 className={r.title} style={{ fontSize: '1.25rem' }}>테마와 꾸미기</h1>
        </div>
      </div>

      <section className={s.group} aria-label="앱 테마">
        <h2 className={s.h2}>앱 테마</h2>
        <div className={s.cards} role="radiogroup" aria-label="테마">
          {data.themes.map((t) => {
            const rt = resolveTheme(t);
            return (
              <button key={t.id} type="button" role="radio" aria-checked={t.id === sel.id} className={`${s.card} ${t.id === sel.id ? s.cardOn : ''}`} onClick={() => setSelId(t.id)}>
                <span className={s.swatch} style={{ background: rt.bg, color: rt.text }} aria-hidden="true">
                  <span className={s.swBar} style={{ background: rt.surface }} />
                  <span className={s.swDots}><span style={{ background: rt.accent }} /><span style={{ background: rt.accent2 }} /></span>
                  가
                </span>
                <span className={s.cardName}>{t.name}</span>
                {t.id === data.activeId && <span className={s.using}>사용 중</span>}
              </button>
            );
          })}
          <button type="button" className={`${s.card} ${s.newCard}`} onClick={() => setEditor(true)}>
            <span className={s.plus} aria-hidden="true">+</span>
            <span className={s.cardName}>사진으로 만들기</span>
          </button>
        </div>
        <button type="button" className={s.row} onClick={() => setSheet('text')}>
          <span>글자색</span>
          <span className={s.meta}><span className={`${s.badge} ${s[level]}`}>{READABILITY_LABEL[level]}</span>{textLabel(sel)} ›</span>
        </button>
        <button type="button" className={s.row} onClick={() => setSheet('font')}>
          <span>글꼴</span>
          <span className={s.meta} style={data.fontId && fontFamilies[data.fontId] ? { fontFamily: `'${fontFamilies[data.fontId]}'` } : undefined}>{fontName} ›</span>
        </button>
        {!sel.builtin && (
          <button type="button" className={s.textBtn} onClick={() => { void deleteTheme(getDb(), sel.id); setSelId(null); toast(`${withEulReul(sel.name)} 지웠어요`); }}>이 테마 지우기</button>
        )}
      </section>

      <section className={s.group} aria-label="대상별 꾸미기">
        <h2 className={s.h2}>대상별 꾸미기</h2>
        {data.targets.map((t) => <TargetRow key={t.id} t={t} onOpen={() => setSheet({ target: t })} />)}
        <p className={u.hint}>넣은 사진은 그 대상의 분류, 세부 화면 위쪽과 응원법 화면에 깔려요. 색은 바뀌지 않고 앱 전체 테마를 따라요. 위의 색은 통계 막대와 내역 표시에만 쓰여요.</p>
      </section>

      {data.cats.length > 0 && (
        <section className={s.group} aria-label="분류별 색">
          <h2 className={s.h2}>분류별 색</h2>
          <div className={u.chips}>
            {data.cats.map(([key, name]) => (
              <button key={key} type="button" className={u.chip} onClick={() => setSheet({ cat: [key, name] })}>
                <span className={s.dot} style={{ background: data.ccolors.get(key) ?? 'var(--accent)' }} aria-hidden="true" />{name}
              </button>
            ))}
          </div>
          <p className={u.hint}>이름이 같은 분류는 모든 대상에서 같은 색을 써요.</p>
        </section>
      )}

      <div className={s.applyBar}>
        <button type="button" className={u.primary} disabled={using} onClick={() => { void applyThemeById(getDb(), sel.id); toast(`${sel.name} 테마를 적용했어요`); }}>
          {using ? '지금 쓰는 테마예요' : `‘${sel.name}’ 테마로 적용`}
        </button>
      </div>

      <Sheet open={sheet === 'text'} onClose={() => setSheet(null)} title="글자색" kicker={sel.name}>
        <div className={s.form}>
          <div className={s.preview} style={{ background: resolved.bg, color: resolved.text }}>글자는 이렇게 보여요 · 대비 {resolved.ratio.toFixed(1)} : 1</div>
          <div className={u.chips} role="radiogroup" aria-label="글자색">
            {TEXT_CHOICES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={sel.text === c.value} className={`${u.chip} ${sel.text === c.value ? u.chipOn : ''}`} onClick={() => void setThemeText(getDb(), sel.id, c.value)}>{c.label}</button>
            ))}
          </div>
          {level !== 'ok' && <p className={u.hint} role="status">글자가 잘 안 보일 수 있어요. 그래도 이 색이 좋으면 그대로 써도 돼요.</p>}
          <p className={u.hint}>자동은 배경에서 가장 잘 보이는 색으로 맞춰요. 버튼과 태그 위 글자는 늘 잘 보이는 색으로 자동으로 맞춰요.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'font'} onClose={() => setSheet(null)} title="글꼴">
        <div className={s.form}>
          <div role="radiogroup" aria-label="글꼴">
            <FontRow name="기본 글꼴" on={!data.fontId} onPick={() => void setFont(getDb(), null)} />
            {data.fonts.map((f) => (
              <FontRow key={f.id} name={f.name} family={fontFamilies[f.id]} on={data.fontId === f.id} onPick={() => void setFont(getDb(), f.id)} onDelete={() => { void deleteFont(getDb(), f.id); toast(`${f.name} 글꼴을 지웠어요`); }} />
            ))}
          </div>
          <label className={u.dashed} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            + 글꼴 파일 넣기
            <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="sr-only" aria-label="글꼴 파일" onChange={(e) => void pickFont(e)} />
          </label>
          {fontErr && <p className={u.error} role="alert">{fontErr}</p>}
          <p className={u.hint}>폰에 있는 글꼴 파일(.ttf, .otf, .woff2)을 넣어요. 고른 글꼴은 앱 전체에 바로 적용돼요. 글꼴 파일은 내보내기에 들어가지 않아요.</p>
        </div>
      </Sheet>

      {sheet && typeof sheet === 'object' && 'target' in sheet && (
        <TargetSheet t={data.targets.find((x) => x.id === sheet.target.id) ?? sheet.target} onClose={() => setSheet(null)} />
      )}

      {sheet && typeof sheet === 'object' && 'cat' in sheet && (
        <Sheet open onClose={() => setSheet(null)} title={sheet.cat[1]} kicker="분류 색">
          <ColorChoices value={data.ccolors.get(sheet.cat[0])} onPick={(c) => void setCategoryColor(getDb(), sheet.cat[1], c)} />
        </Sheet>
      )}
    </div>
  );
}

function FontRow({ name, family, on, onPick, onDelete }: { name: string; family?: string; on: boolean; onPick: () => void; onDelete?: () => void }) {
  return (
    <div className={s.fontRow}>
      <button type="button" role="radio" aria-checked={on} className={s.fontPick} onClick={onPick} style={family ? { fontFamily: `'${family}'` } : undefined}>
        <span className={s.radio} aria-hidden="true">{on ? '●' : '○'}</span>{name}
      </button>
      {onDelete && <button type="button" className={s.x} aria-label={`${name} 글꼴 지우기`} onClick={onDelete}>✕</button>}
    </div>
  );
}

function useFontFamilies(ids: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(key.split(',').filter(Boolean).map(async (id) => [id, await loadFont(id)] as const)).then((pairs) => {
      if (alive) setMap(Object.fromEntries(pairs.filter(([, f]) => f) as [string, string][]));
    });
    return () => { alive = false; };
  }, [key]);
  return map;
}

function TargetRow({ t, onOpen }: { t: Target; onOpen: () => void }) {
  const photo = usePhoto(t.photoId);
  return (
    <button type="button" className={s.row} onClick={onOpen}>
      <span className={s.targetName}>
        <span className={s.thumb} style={photo ? { backgroundImage: `url("${photo.url}")` } : { background: 'var(--soft)' }} aria-hidden="true" />
        {t.name}
      </span>
      <span className={s.meta}><span className={s.dot} style={{ background: t.color }} aria-hidden="true" />색 · 사진 ›</span>
    </button>
  );
}

function ColorChoices({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  return (
    <div className={s.colors} role="radiogroup" aria-label="색">
      {COLOR_CHOICES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} className={`${s.colorBtn} ${value === c ? s.colorOn : ''}`} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

function TargetSheet({ t, onClose }: { t: Target; onClose: () => void }) {
  const toast = useToast();
  const photo = usePhoto(t.photoId);
  const [busy, setBusy] = useState(false);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { blob, width, height } = await resizePhoto(file);
      const id = await savePhoto(getDb(), blob, width, height, file.name);
      await setTargetPhoto(getDb(), t.id, id);
      toast(`${t.name}에 사진을 넣었어요`);
    } catch {
      toast('사진을 읽을 수 없어요');
    } finally {
      setBusy(false);
    }
  };
  const bg = useMemo(() => (photo ? { backgroundImage: `url("${photo.url}")` } : undefined), [photo]);
  return (
    <Sheet open onClose={onClose} title={t.name} kicker="대상별 꾸미기">
      <div className={s.form}>
        <span className={u.label}>표시 색</span>
        <ColorChoices value={t.color} onPick={(c) => void setTargetColor(getDb(), t.id, c)} />
        <span className={u.label}>배경 사진</span>
        {photo && <div className={s.photoPreview} style={bg} role="img" aria-label={`${t.name} 사진`} />}
        <div className={s.photoBtns}>
          <label className={u.ghost} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {busy ? '넣는 중…' : photo ? '사진 바꾸기' : '사진 넣기'}
            <input type="file" accept="image/*" className="sr-only" aria-label="대상 사진" onChange={(e) => void pick(e)} />
          </label>
          {t.photoId && <button type="button" className={u.ghost} onClick={() => { void setTargetPhoto(getDb(), t.id, null); toast('사진을 뺐어요'); }}>사진 빼기</button>}
        </div>
        <p className={u.hint}>사진은 색을 바꾸지 않아요. 화면 색은 언제나 앱 테마를 따라요.</p>
      </div>
    </Sheet>
  );
}
