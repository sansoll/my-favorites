import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getDb } from '../../data/db';
import { addTarget, ListError } from '../../data/repo/lists';
import { listPresets } from '../../data/repo/presets';
import { NameSheet } from '../../components/NameSheet';
import { useToast } from '../../components/Toast';
import { josa } from '../../domain/name';
import { presetSummary } from '../../domain/presets';
import u from '../../components/ui.module.css';

/** 새 대상 창: 이름 + 프리셋(만들어 둔 프리셋, 빈 목록) 고르기 */
export function NewTargetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const presets = useLiveQuery(() => listPresets(getDb()), []) ?? [];
  const [pick, setPick] = useState<string | null>(null);
  const chosen = presets.find((p) => p.id === pick) ?? null;

  return (
    <NameSheet
      open={open}
      title="새 대상"
      submitLabel="추가"
      onClose={() => { setPick(null); onClose(); }}
      onSubmit={async (name) => {
        try {
          const t = await addTarget(getDb(), name, chosen ?? undefined);
          setPick(null);
          onClose();
          toast(`${josa(t.name, '을/를')} 추가했어요`);
          return null;
        } catch (e) {
          if (e instanceof ListError) return e.reason;
          throw e;
        }
      }}
    >
      <div className={u.field} role="radiogroup" aria-label="프리셋">
        <span className={u.label}>프리셋으로 분류와 세부 한 번에 넣기</span>
        <div className={u.chips}>
          {presets.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={`${u.chip} ${pick === p.id ? u.chipOn : ''}`} onClick={() => setPick(p.id)}>{p.name}</button>
          ))}
          <button type="button" role="radio" aria-checked={pick === null} className={`${u.chip} ${pick === null ? u.chipOn : ''}`} onClick={() => setPick(null)}>빈 목록</button>
        </div>
        <p className={u.hint}>{presetSummary(chosen?.items ?? [])}</p>
      </div>
    </NameSheet>
  );
}
