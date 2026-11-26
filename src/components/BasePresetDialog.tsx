import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { BASE_PRESETS } from '../domain/presets';
import { sameName } from '../domain/name';
import c from './ConfirmDialog.module.css';
import s from './BasePresetDialog.module.css';
import u from './ui.module.css';

export interface BasePresetDialogProps {
  open: boolean;
  /** 이미 있는 프리셋 이름(같은 이름은 건너뜀) */
  existing: string[];
  onLater: () => void;
  onMake: (names: string[]) => void;
}

/** "자주 쓰는 프리셋을 만들어 둘까요?" 가수용·배우용은 기본으로 체크돼 있습니다. */
export function BasePresetDialog({ open, existing, onLater, onMake }: BasePresetDialogProps) {
  const titleId = useId();
  const has = (n: string) => existing.some((e) => sameName(e, n));
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => { if (open) setTouched({}); }, [open]);

  if (!open) return null;
  const picked = (name: string) => touched[name] ?? BASE_PRESETS.find((b) => b.name === name)!.checked;
  const chosen = BASE_PRESETS.filter((b) => picked(b.name) && !has(b.name)).map((b) => b.name);
  const allExist = BASE_PRESETS.every((b) => has(b.name));

  return createPortal(
    <div className={c.backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={c.box}>
        <h2 id={titleId} className={c.title}>자주 쓰는 프리셋을 만들어 둘까요?</h2>
        <p className={c.body}>체크한 프리셋만 만들어요. 새 대상을 추가할 때 고르면 분류와 세부가 한 번에 들어가요.</p>
        <div>
          {BASE_PRESETS.map((b) => {
            const exists = has(b.name);
            const on = !exists && picked(b.name);
            return (
              <button key={b.name} type="button" role="checkbox" aria-checked={on} disabled={exists} className={s.opt} onClick={() => setTouched({ ...touched, [b.name]: !on })}>
                <span className={`${s.box} ${exists ? s.off : on ? s.on : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>
                <span>
                  <span className={s.name}>{b.name}</span>
                  <span className={s.sub}>{exists ? '이미 있어서 건너뛰어요' : b.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className={u.hint}>나중에 설정 › 프리셋의 기본 프리셋 추가에서 다시 만들 수 있어요.</p>
        <div className={c.row}>
          <button type="button" className={`${c.btn} ${c.cancel}`} onClick={onLater}>나중에</button>
          <button type="button" className={`${c.btn} ${c.ok}`} disabled={!chosen.length} style={chosen.length ? undefined : { opacity: 0.5 }} onClick={() => onMake(chosen)}>
            {chosen.length ? `${chosen.length}개 만들기` : allExist ? '모두 있어요' : '만들기'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
