import { toResults as kakaoResults } from '../../services/places/kakao';
import { MIN_INTERVAL_MS, osmSearch, toResults as osmResults } from '../../services/places/osm';
import { SearchError } from '../../services/places/types';
import { hasHangul } from '../../services/places';
import { freshDb } from '../../test/db';
import type { FavoritesDB } from '../db';
import { addTarget, listCategories } from './lists';
import { linkNamePlace, mapUrl, namePlace, recentPlaces, searchPlace } from './places';
import { saveRecord } from './records';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

describe('장소 저장 (U5-1)', () => {
  it('이름만 남긴 장소는 같은 이름(공백 무시)이면 하나', async () => {
    const a = await namePlace(db, '성수 팝업스토어');
    const b = await namePlace(db, ' 성수  팝업스토어 ');
    const c = await namePlace(db, '성수팝업스토어');
    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    await expect(namePlace(db, '  ')).rejects.toMatchObject({ reason: 'empty' });
  });

  it('같은 출처·같은 번호는 하나로 재사용, 이름이 달라도', async () => {
    const a = await searchPlace(db, { source: 'kakao', externalId: '123', name: 'KSPO DOME' });
    const b = await searchPlace(db, { source: 'kakao', externalId: '123', name: '케이스포돔' });
    const c = await searchPlace(db, { source: 'osm', externalId: '123', name: 'KSPO' });
    expect(b.id).toBe(a.id);
    expect(c.id).not.toBe(a.id);
    expect(await db.places.count()).toBe(2);
  });

  it('카카오 결과는 번호·이름만 저장(주소·좌표 없음)', async () => {
    const r = kakaoResults([{ id: '8', place_name: 'KSPO DOME', road_address_name: '서울 송파구 올림픽로 424', address_name: '서울 송파구 방이동 88' }])[0];
    expect(r).toEqual({ source: 'kakao', externalId: '8', name: 'KSPO DOME', sub: '서울 송파구 올림픽로 424' });
    const p = await searchPlace(db, r);
    expect(Object.keys(p).sort()).toEqual(['externalId', 'id', 'name', 'source']);
  });

  it('이름만 장소를 나중에 검색 결과로 연결하면 그 이름의 기록이 함께 옮겨짐', async () => {
    const t = await addTarget(db, '가수 A');
    const c = (await listCategories(db, t.id))[0];
    const np = await namePlace(db, '도쿄돔');
    const r1 = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1, placeId: np.id });
    const r2 = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 2, placeId: np.id });
    const linked = await linkNamePlace(db, np.id, { source: 'osm', externalId: 'W123', name: 'Tokyo Dome' });
    expect((await db.records.get(r1.id))!.placeId).toBe(linked.id);
    expect((await db.records.get(r2.id))!.placeId).toBe(linked.id);
    expect(await db.places.get(np.id)).toBeUndefined();
    expect(linked.name).toBe('Tokyo Dome');
  });

  it('전에 간 곳은 최근 순, 한 번씩', async () => {
    const t = await addTarget(db, '가수 A');
    const c = (await listCategories(db, t.id))[0];
    const a = await namePlace(db, 'A');
    const b = await namePlace(db, 'B');
    await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1, placeId: a.id, date: '2026-10-01' });
    await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1, placeId: b.id, date: '2026-11-01' });
    await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1, placeId: a.id, date: '2026-09-01' });
    expect((await recentPlaces(db)).map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('지도 주소: 국내는 카카오맵, 해외·이름만은 구글 지도', () => {
    expect(mapUrl({ id: '1', source: 'kakao', externalId: '8', name: 'KSPO DOME' })).toBe('https://place.map.kakao.com/8');
    expect(mapUrl({ id: '2', source: 'osm', externalId: 'W1', name: 'Tokyo Dome' })).toBe('https://www.google.com/maps/search/?api=1&query=Tokyo%20Dome');
    expect(mapUrl({ id: '3', source: 'name', externalId: '', name: '성수 팝업' })).toContain('google.com/maps/search');
  });
});

describe('해외 장소 검색 (U5-3)', () => {
  const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));

  it('결과 변환: 번호는 종류+번호, 이름이 없으면 주소 첫 부분', () => {
    expect(osmResults([
      { osm_type: 'way', osm_id: 1, name: 'Tokyo Dome', display_name: 'Tokyo Dome, 1, Koraku, Bunkyo, Tokyo, Japan' },
      { osm_type: 'node', osm_id: 2, display_name: 'Wembley Stadium, London, UK' },
    ])).toEqual([
      { source: 'osm', externalId: 'W1', name: 'Tokyo Dome', sub: '1, Koraku, Bunkyo' },
      { source: 'osm', externalId: 'N2', name: 'Wembley Stadium', sub: 'London, UK' },
    ]);
  });

  it('1초에 한 번 넘게 요청하지 않음', async () => {
    let t = 0;
    const calls: number[] = [];
    const waits: number[] = [];
    const svc = osmSearch(((url: string) => { calls.push(t); expect(url).toContain('format=jsonv2'); return json([]); }) as unknown as typeof fetch,
      () => t, async (ms) => { waits.push(ms); t += ms; });
    await Promise.all([svc.search('a'), svc.search('b'), svc.search('c')]);
    expect(calls).toEqual([0, MIN_INTERVAL_MS, 2 * MIN_INTERVAL_MS]);
    t += 5000;
    await svc.search('d');
    expect(waits).toEqual([MIN_INTERVAL_MS, MIN_INTERVAL_MS]);
  });

  it('인터넷이 없으면 offline 오류', async () => {
    const svc = osmSearch((() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch, () => 0, async () => {});
    await expect(svc.search('x')).rejects.toEqual(new SearchError('offline'));
  });

  it('한글 검색어 알아보기', () => {
    expect(hasHangul('도쿄돔')).toBe(true);
    expect(hasHangul('Tokyo Dome')).toBe(false);
  });
});
