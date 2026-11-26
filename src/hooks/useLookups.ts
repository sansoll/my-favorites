import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../data/db';
import type { Category, Detail, SpendRecord, Target } from '../data/types';

export interface Lookups {
  targets: Map<string, Target>;
  categories: Map<string, Category>;
  details: Map<string, Detail>;
}

/** 기록에 보일 이름을 찾는 표. 목록이 바뀌면 다시 읽습니다. */
export function useLookups(): Lookups | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [t, c, d] = await Promise.all([db.targets.toArray(), db.categories.toArray(), db.details.toArray()]);
    return { targets: new Map(t.map((x) => [x.id, x])), categories: new Map(c.map((x) => [x.id, x])), details: new Map(d.map((x) => [x.id, x])) };
  }, []);
}

/** `행사 › 콘서트`. 세부가 기타이고 기타 내용이 있으면 그 글을 보여 줍니다. */
export function recordPath(l: Lookups, r: SpendRecord): string {
  const c = l.categories.get(r.categoryId);
  const d = l.details.get(r.detailId);
  const det = d?.isEtc && r.etcText ? r.etcText : d?.name ?? '';
  return `${c?.name ?? ''} › ${det}`;
}
