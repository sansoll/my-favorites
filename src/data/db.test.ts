import Dexie from 'dexie';
import { DB_VERSION, FavoritesDB, SCHEMA_V1, STORE_NAMES, newId } from './db';
import { requestPersistOnce } from './persist';

let n = 0;
const freshName = () => `test-db-${++n}-${Date.now()}`;

describe('저장 구조 v1 (U0-3)', () => {
  it('처음 열면 DESIGN 3장의 모든 저장소가 생김', async () => {
    const db = new FavoritesDB(freshName());
    await db.open();
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual([...STORE_NAMES].sort());
    expect(names).toEqual(
      ['blobs', 'categories', 'categoryColors', 'checkDays', 'checkItems', 'details', 'places', 'presets',
        'records', 'recurrings', 'settings', 'songOpens', 'songs', 'targets', 'themes'],
    );
    expect(db.verno).toBe(DB_VERSION);
    db.close();
  });

  it('v1→v2 가짜 변환을 돌려도 기존 기록이 그대로', async () => {
    const name = freshName();
    const v1 = new FavoritesDB(name);
    const id = newId();
    await v1.records.add({
      id, date: '2026-11-13', targetId: 't', categoryId: 'c', detailId: 'd', etcText: '', paid: 154000,
      refund: 30000, memo: '메모', createdAt: 1, updatedAt: 1,
    });
    v1.close();

    // 다음 버전에서 저장소를 하나 더하고 기록에 필드를 채우는 상황을 흉내 냅니다.
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2)
      .stores({ ...SCHEMA_V1, extraStore: 'id' })
      .upgrade((tx) => tx.table('records').toCollection().modify((r) => { r.tags = []; }));
    await v2.open();
    const rec = await v2.table('records').get(id);
    expect(rec).toMatchObject({ id, paid: 154000, refund: 30000, memo: '메모', tags: [] });
    expect(v2.verno).toBe(2);
    v2.close();
  });

  it('영구 저장 요청은 한 번만 호출', async () => {
    const db = new FavoritesDB(freshName());
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    expect(await requestPersistOnce(db)).toBe(true);
    expect(await requestPersistOnce(db)).toBe(null);
    expect(persist).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    db.close();
  });

  it('영구 저장을 지원하지 않아도 오류 없이 넘어감', async () => {
    const db = new FavoritesDB(freshName());
    vi.stubGlobal('navigator', { ...navigator, storage: undefined });
    expect(await requestPersistOnce(db)).toBe(null);
    vi.unstubAllGlobals();
    db.close();
  });
});
