import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import { listCategories, listDetails, listTargets } from '../data/repo/lists';
import u from './ui.module.css';

export interface ListPick {
  targetId: string;
  categoryId: string;
  /** 비우면 기타 */
  detailId?: string;
}

/** 대상 → 분류 → 세부를 칩으로 고릅니다. 위를 바꾸면 아래는 다시 고릅니다. */
export function ListPicker({ value, onChange, detailOptional = false }: { value: Partial<ListPick>; onChange: (v: Partial<ListPick>) => void; detailOptional?: boolean }) {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const targets = await listTargets(db);
    const cats = value.targetId ? await listCategories(db, value.targetId) : [];
    const dets = value.categoryId ? await listDetails(db, value.categoryId) : [];
    return { targets, cats, dets };
  }, [value.targetId, value.categoryId]);
  if (!data) return null;
  const group = (label: string, items: { id: string; name: string }[], cur: string | undefined, pick: (id: string) => void) => (
    <div className={u.field} role="radiogroup" aria-label={label}>
      <span className={u.label}>{label}</span>
      <div className={u.chips}>
        {items.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={cur === x.id} className={`${u.chip} ${cur === x.id ? u.chipOn : ''}`} onClick={() => pick(x.id)}>{x.name}</button>
        ))}
      </div>
    </div>
  );
  return (
    <>
      {group('대상', data.targets, value.targetId, (id) => onChange({ targetId: id }))}
      {value.targetId && group('분류', data.cats, value.categoryId, (id) => onChange({ targetId: value.targetId, categoryId: id }))}
      {value.categoryId && group(detailOptional ? '세부 (고르지 않으면 기타)' : '세부', data.dets, value.detailId, (id) => onChange({ ...value, detailId: id }))}
    </>
  );
}
