import { FavoritesDB, setDb } from '../data/db';

let n = 0;
/** 테스트마다 새 저장소를 씁니다. */
export function freshDb(): FavoritesDB {
  const db = new FavoritesDB(`test-${++n}-${Math.random().toString(36).slice(2)}`);
  setDb(db);
  return db;
}
