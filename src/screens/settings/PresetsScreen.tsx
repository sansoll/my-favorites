import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { addPreset, changePreset, presetUsers, type PresetChange, type PresetScope } from '../../data/repo/edit';
import { ListError } from '../../data/repo/lists';
import { createBasePresets, listPresets } from '../../data/repo/presets';
import { BasePresetDialog } from '../../components/BasePresetDialog';
import { NameSheet, type NameError } from '../../components/NameSheet';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { josa, sameName } from '../../domain/name';
import u from '../../components/ui.module.css';
import r from '../record/Record.module.css';
import s from './Presets.module.css';

type Adding = { kind: 'preset' } | { kind: 'category' } | { kind: 'detail'; category: string };

function describe(ch: PresetChange): string {
  switch (ch.op) {
    case 'addCategory': return `분류 ${josa(ch.category, '을/를')} 넣었어요`;
    case 'removeCategory': return `분류 ${josa(ch.category, '을/를')} 뺐어요`;
    case 'addDetail': return `${ch.category}에 ${josa(ch.detail, '을/를')} 넣었어요`;
    case 'removeDetail': return `${ch.category}에서 ${josa(ch.detail, '을/를')} 뺐어요`;
  }
}

/** 설정 › 프리셋. 넣거나 빼면, 이 프리셋으로 만든 대상이 있을 때 적용 범위를 묻습니다. */
export function PresetsScreen() {
  const toast = useToast();
  const presets = useLiveQuery(() => listPresets(getDb()), []);
  const [curId, setCurId] = useState<string | null>(null);
  const cur = presets?.find((p) => p.id === curId) ?? presets?.[0];
  const users = useLiveQuery(() => (cur ? presetUsers(getDb(), cur.id) : Promise.resolve([])), [cur?.id]) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [scope, setScope] = useState<{ ch: PresetChange; picking: boolean; picked: Set<string> } | null>(null);
  const [base, setBase] = useState(false);

  if (!presets) return null;

  const run = async (ch: PresetChange, sc: PresetScope) => {
    await changePreset(getDb(), cur!.id, ch, sc);
    setScope(null);
    toast(sc === 'only' ? describe(ch) : `${describe(ch)} · 대상에도 반영했어요`);
  };
  const change = (ch: PresetChange) => {
    if (!users.length) void run(ch, 'only');
    else setScope({ ch, picking: false, picked: new Set() });
  };
  const submitName = async (name: string): Promise<NameError | null> => {
    if (!adding) return null;
    const clean = name.trim();
    if (adding.kind === 'preset') {
      try {
        const p = await addPreset(getDb(), name);
        setAdding(null);
        setCurId(p.id);
        return null;
      } catch (e) {
        if (e instanceof ListError) return e.reason;
        throw e;
      }
    }
    if (!clean) return 'empty';
    if (adding.kind === 'category') {
      if (sameName(clean, '기타') || cur!.items.some((i) => sameName(i.name, clean))) return 'duplicate';
      setAdding(null);
      change({ op: 'addCategory', category: clean });
    } else {
      const c = cur!.items.find((i) => i.name === adding.category)!;
      if (sameName(clean, '기타') || c.details.some((d) => sameName(d, clean))) return 'duplicate';
      setAdding(null);
      change({ op: 'addDetail', category: adding.category, detail: clean });
    }
    return null;
  };

  return (
    <div className={r.screen}>
      <div className={r.crumbs}>
        <Link to="/settings" className={r.back} aria-label="뒤로">‹</Link>
        <h1 className={r.title} style={{ fontSize: '1.25rem' }}>프리셋</h1>
      </div>
      <div className={s.tabs} role="tablist" aria-label="프리셋">
        {presets.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={cur?.id === p.id} className={`${u.chip} ${cur?.id === p.id ? u.chipOn : ''}`} onClick={() => setCurId(p.id)}>{p.name}</button>
        ))}
        <button type="button" className={u.chip} style={{ borderStyle: 'dashed', color: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => setAdding({ kind: 'preset' })}>+ 새 프리셋</button>
      </div>
      {cur ? (
        <>
          <p className={s.usage}>{users.length ? `이 프리셋으로 만든 대상: ${users.map((x) => x.name).join(', ')}` : '아직 이 프리셋으로 만든 대상이 없어요.'}</p>
          <div>
            {cur.items.map((c) => (
              <div key={c.name} className={s.cat}>
                <div className={s.catHead}>
                  <button type="button" className={s.catBtn} aria-expanded={open === c.name} onClick={() => setOpen(open === c.name ? null : c.name)}>
                    <span>{c.name}</span><span className={s.catMeta}>세부 {c.details.length + 1} {open === c.name ? '▴' : '▾'}</span>
                  </button>
                  <button type="button" className={s.x} aria-label={`${c.name} 빼기`} onClick={() => change({ op: 'removeCategory', category: c.name })}>✕</button>
                </div>
                {open === c.name && (
                  <div className={s.dets}>
                    {c.details.map((d) => (
                      <span key={d} className={s.det}>{d}<button type="button" className={s.detX} aria-label={`${d} 빼기`} onClick={() => change({ op: 'removeDetail', category: c.name, detail: d })}>✕</button></span>
                    ))}
                    <span className={s.etc}>기타</span>
                    <button type="button" className={s.addDet} onClick={() => setAdding({ kind: 'detail', category: c.name })}>+ 세부</button>
                  </div>
                )}
              </div>
            ))}
            <div className={s.cat}><div className={s.catHead}><span className={s.catBtn} style={{ color: 'var(--text-muted)' }}>기타</span></div></div>
          </div>
          <button type="button" className={u.dashed} onClick={() => setAdding({ kind: 'category' })}>+ 분류 추가</button>
        </>
      ) : (
        <p className={s.usage}>아직 프리셋이 없어요. 새 프리셋을 만들거나 기본 프리셋을 추가해 보세요.</p>
      )}
      <p className={u.hint}>새 대상을 추가할 때 프리셋을 고르면 이 분류와 세부 버튼이 한 번에 들어가요. 기타는 어느 프리셋에나 항상 있어요.</p>
      <button type="button" className={u.ghost} style={{ minHeight: '3.25rem', borderRadius: 'var(--radius-card)' }} onClick={() => setBase(true)}>기본 프리셋 추가</button>

      <NameSheet
        open={!!adding}
        title={adding?.kind === 'preset' ? '새 프리셋' : adding?.kind === 'category' ? '분류 추가' : '세부 추가'}
        kicker={adding?.kind === 'detail' ? `${cur?.name} › ${adding.category}` : adding?.kind === 'category' ? cur?.name : undefined}
        submitLabel="추가"
        onClose={() => setAdding(null)}
        onSubmit={submitName}
      />
      <Sheet open={!!scope} onClose={() => setScope(null)} title={scope?.picking ? '적용할 대상' : '어디에 적용할까요?'} kicker={scope ? describe(scope.ch).replace(/었어요$|았어요$/, '') : undefined}>
        {scope && !scope.picking && (
          <div className={s.list}>
            <button type="button" className={s.opt} onClick={() => void run(scope.ch, 'only')}>프리셋에만<span className={s.optSub}>이미 만든 대상은 그대로예요</span></button>
            <button type="button" className={s.opt} onClick={() => void run(scope.ch, 'all')}>대상 전체<span className={s.optSub}>{users.map((x) => x.name).join(', ')}</span></button>
            <button type="button" className={s.opt} onClick={() => setScope({ ...scope, picking: true })}>대상 골라서<span className={s.optSub}>적용할 대상을 직접 체크해요</span></button>
            {(scope.ch.op === 'removeCategory' || scope.ch.op === 'removeDetail') && <p className={u.hint}>대상에서 빼면 그 기록은 삭제할 때처럼 기타로 옮겨져요.</p>}
          </div>
        )}
        {scope?.picking && (
          <>
            <div>
              {users.map((x) => {
                const on = scope.picked.has(x.id);
                return (
                  <button key={x.id} type="button" role="checkbox" aria-checked={on} className={s.pick} onClick={() => { const n = new Set(scope.picked); if (on) n.delete(x.id); else n.add(x.id); setScope({ ...scope, picked: n }); }}>
                    <span className={`${s.box} ${on ? s.boxOn : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>{x.name}
                  </button>
                );
              })}
            </div>
            <button type="button" className={u.primary} disabled={!scope.picked.size} onClick={() => void run(scope.ch, [...scope.picked])}>{scope.picked.size ? `${scope.picked.size}개 대상에 적용` : '대상을 골라 주세요'}</button>
          </>
        )}
      </Sheet>
      <BasePresetDialog
        open={base}
        existing={presets.map((p) => p.name)}
        onLater={() => setBase(false)}
        onMake={async (names) => {
          const made = await createBasePresets(getDb(), names);
          setBase(false);
          if (made.length) toast(`${made.join(', ')} 프리셋을 만들었어요`);
        }}
      />
    </div>
  );
}
