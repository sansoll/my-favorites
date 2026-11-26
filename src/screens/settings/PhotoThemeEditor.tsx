import { useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import { getDb } from '../../data/db';
import { savePhotoTheme, type ThemeDraft } from '../../data/repo/theme';
import { BLACK, resolveTheme, themeCombos, WHITE, type Combo } from '../../theme/color';
import { readPalette, type PhotoPalette } from '../../services/palette';
import { Sheet } from '../../components/Sheet';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Theme.module.css';

type Role = 'bg' | 'surface' | 'accent' | 'accent2' | 'text';
const ROLES: [Role, string, string][] = [
  ['bg', '배경', '화면 바닥'],
  ['surface', '카드', '목록 칸, 입력 칸'],
  ['accent', '강조', '버튼, 선택 표시, 스위치'],
  ['accent2', '보조 강조', '차트 막대, 태그'],
  ['text', '글자', '본문 글자'],
];

const fromCombo = (c: Combo, text = 'auto'): ThemeDraft => ({ bg: c.bg, surface: c.surface, accent: c.accent, accent2: c.accent2, text });

/** 사진으로 테마 만들기(STORYBOARD 9): 사진 고르기 → 뽑은 색과 미리보기 → 하나씩 바꾸기·다른 조합·스포이드 → 적용 */
export function PhotoThemeEditor({ onClose, onApplied }: { onClose: () => void; onApplied: (name: string) => void }) {
  const [pal, setPal] = useState<PhotoPalette | null>(null);
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [comboIdx, setComboIdx] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [roleSheet, setRoleSheet] = useState<Role | null>(null);
  const [alts, setAlts] = useState(false);
  const [spoid, setSpoid] = useState<Role | null>(null);

  useEffect(() => () => pal?.dispose(), [pal]);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const p = await readPalette(file);
      if (!p.colors.length) throw new Error('empty');
      setPal(p);
      setDraft(fromCombo(themeCombos(p.colors)[0]));
      setComboIdx(0);
      setErr(null);
    } catch {
      setErr('사진을 읽을 수 없어요. 다른 사진을 골라 주세요.');
    }
  };

  const fileInput = (label: string) => (
    <label className={u.primary} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {label}
      <input type="file" accept="image/*" className="sr-only" aria-label="테마 사진" onChange={(e) => void pick(e)} />
    </label>
  );

  const head = (
    <div className={r.head}>
      <div className={r.crumbs}>
        <button type="button" className={r.back} aria-label="뒤로" onClick={onClose} style={{ border: 0, background: 'none' }}>‹</button>
        <h1 className={r.title} style={{ fontSize: '1.25rem' }}>새 테마</h1>
      </div>
    </div>
  );

  if (!pal || !draft) {
    return (
      <div className={r.screen}>
        {head}
        <p className={u.hint}>사진을 고르면 색을 뽑아서 어디에 어떤 색이 쓰일지 먼저 보여 드려요.</p>
        {fileInput('사진 고르기')}
        {err && <p className={u.error} role="alert">{err}</p>}
      </div>
    );
  }

  const combos = themeCombos(pal.colors);
  const single = pal.colors.length === 1;
  const t = resolveTheme(draft);
  const setRole = (role: Role, v: string) => { setDraft({ ...draft, [role]: v }); if (role !== 'text') setComboIdx(-1); };

  const onPhotoClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!spoid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    const y = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
    setRole(spoid, pal.pick(x, y));
    setSpoid(null);
  };

  const roleOptions = (role: Role) => {
    const list = role === 'text' ? ['auto', BLACK, WHITE, ...pal.colors] : [...pal.colors, WHITE, BLACK];
    return list.filter((c, i) => list.indexOf(c) === i);
  };

  return (
    <div className={r.screen}>
      {head}
      <div className={`${s.photo} ${spoid ? s.photoSpoid : ''}`} style={{ backgroundImage: `url("${pal.url}")` }} role="img" aria-label={spoid ? '사진에서 원하는 곳을 눌러요' : '고른 사진'} onClick={onPhotoClick} />
      {spoid && <p className={s.spoidHint} role="status">사진에서 원하는 곳을 눌러요. ({ROLES.find((x) => x[0] === spoid)?.[1]})</p>}

      <section className={s.group} aria-label="뽑은 색">
        <h2 className={s.h2}>뽑은 색</h2>
        <div className={s.extracted}>{pal.colors.map((c) => <span key={c} className={s.colorBtn} style={{ background: c }} title={c} />)}</div>
        {single && <p className={u.hint}>사진에 색이 한 가지뿐이라 전부 그 색으로 만들었어요. 글자만 잘 보이게 자동으로 맞췄어요.</p>}
      </section>

      <section className={s.group} aria-label="미리보기">
        <h2 className={s.h2}>이렇게 보여요{comboIdx >= 0 ? ` · ${combos[comboIdx]?.label}` : ''}</h2>
        <div className={s.mock} style={{ background: t.bg, color: t.text }}>
          <strong>내가 좋아하는 것들</strong>
          <div className={s.mockCard} style={{ background: t.surface }}>가수 A <span>124,000원</span></div>
          <div className={s.mockRow}>
            <span className={s.mockBtn} style={{ background: t.accent, color: t.onAccent }}>저장</span>
            <span className={s.mockTag} style={{ background: t.accent2, color: resolveTheme({ ...draft, bg: t.accent2, text: 'auto' }).text }}>행사</span>
          </div>
        </div>
      </section>

      <section className={s.group} aria-label="어디에 어떤 색이 쓰이나요">
        <h2 className={s.h2}>어디에 어떤 색이 쓰이나요</h2>
        {ROLES.map(([role, name, where]) => (
          <button key={role} type="button" className={s.row} onClick={() => setRoleSheet(role)}>
            <span><span className={s.roleName}>{name}</span><span className={s.where}>{where}</span></span>
            <span className={s.meta}>
              <span className={s.dot} style={{ background: role === 'text' ? t.text : draft[role], outline: '1px solid var(--line)' }} aria-hidden="true" />
              {role === 'text' && draft.text === 'auto' ? '자동' : (role === 'text' ? t.text : draft[role])} ›
            </span>
          </button>
        ))}
        <p className={u.hint}>눌러서 하나씩 바꿀 수 있어요.</p>
      </section>

      <div className={s.photoBtns}>
        <button type="button" className={u.ghost} disabled={single} onClick={() => setAlts(true)}>다른 조합 {combos.length - 1}개 보기</button>
        <button type="button" className={u.ghost} onClick={() => setRoleSheet('accent')}>스포이드로 찍기</button>
      </div>
      {fileInput('다른 사진')}
      <button type="button" className={u.primary} onClick={() => void savePhotoTheme(getDb(), draft).then((th) => onApplied(th.name))}>이 테마 적용</button>

      <Sheet open={roleSheet !== null} onClose={() => setRoleSheet(null)} title="어디에 쓸 색인가요?" kicker={roleSheet ? ROLES.find((x) => x[0] === roleSheet)?.[1] : undefined}>
        {roleSheet && (
          <div className={s.form}>
            <div className={u.chips} role="radiogroup" aria-label="쓸 자리">
              {ROLES.map(([role, name]) => (
                <button key={role} type="button" role="radio" aria-checked={roleSheet === role} className={`${u.chip} ${roleSheet === role ? u.chipOn : ''}`} onClick={() => setRoleSheet(role)}>{name}</button>
              ))}
            </div>
            <div className={s.colors} role="radiogroup" aria-label="색">
              {roleOptions(roleSheet).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={draft[roleSheet] === c} aria-label={c === 'auto' ? '자동 (추천)' : c} className={`${s.colorBtn} ${draft[roleSheet] === c ? s.colorOn : ''}`} style={{ background: c === 'auto' ? `linear-gradient(135deg, ${BLACK} 50%, ${WHITE} 50%)` : c }} onClick={() => setRole(roleSheet, c)} />
              ))}
            </div>
            <button type="button" className={u.ghost} onClick={() => { setSpoid(roleSheet); setRoleSheet(null); }}>사진에서 스포이드로 찍기</button>
          </div>
        )}
      </Sheet>

      <Sheet open={alts} onClose={() => setAlts(false)} title="다른 조합" kicker="같은 사진 색">
        <div className={s.form}>
          <p className={u.hint}>같은 사진 색으로 만든 다른 조합이에요.</p>
          <div className={s.cards}>
            {combos.map((c, i) => {
              const rc = resolveTheme({ ...c, text: 'auto' });
              return (
                <button key={c.label} type="button" className={`${s.card} ${i === comboIdx ? s.cardOn : ''}`} aria-pressed={i === comboIdx} onClick={() => { setDraft(fromCombo(c, draft.text)); setComboIdx(i); setAlts(false); }}>
                  <span className={s.swatch} style={{ background: rc.bg, color: rc.text }} aria-hidden="true">
                    <span className={s.swBar} style={{ background: rc.surface }} />
                    <span className={s.swDots}><span style={{ background: rc.accent }} /><span style={{ background: rc.accent2 }} /></span>가
                  </span>
                  <span className={s.cardName}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
