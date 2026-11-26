import type { FavoritesDB } from './db';
import { getSetting, setSetting } from './settings';

const KEY = 'persistRequested';

/**
 * 크롬에 영구 저장을 요청합니다(DESIGN 5장). 첫 기록을 저장할 때 한 번만 부릅니다.
 * 지원하지 않는 브라우저에서는 조용히 넘어갑니다.
 */
export async function requestPersistOnce(db: FavoritesDB): Promise<boolean | null> {
  if (await getSetting(db, KEY, false)) return null;
  await setSetting(db, KEY, true);
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist) return null;
  try {
    return await storage.persist();
  } catch {
    return null;
  }
}
