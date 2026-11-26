import { cleanName, sameName } from '../../domain/name';
import { newId, type FavoritesDB } from '../db';
import type { Place } from '../types';

/** 검색으로 고른 장소. 카카오는 번호와 이름만 남깁니다(주소·좌표 저장 금지). */
export interface PlacePick {
  source: 'kakao' | 'osm';
  externalId: string;
  name: string;
}

export class PlaceError extends Error {
  constructor(public reason: 'empty' | 'notFound') {
    super(reason);
  }
}

/** 이름만 남긴 장소. 같은 이름(공백 무시)은 하나로 씁니다. */
export async function namePlace(db: FavoritesDB, name: string): Promise<Place> {
  const n = cleanName(name);
  if (!n) throw new PlaceError('empty');
  return db.transaction('rw', db.places, async () => {
    const same = (await db.places.where('[source+externalId]').equals(['name', '']).toArray()).find((p) => sameName(p.name, n));
    if (same) return same;
    const p: Place = { id: newId(), source: 'name', externalId: '', name: n };
    await db.places.add(p);
    return p;
  });
}

/** 검색 결과 장소. 같은 출처·같은 번호는 하나로 다시 씁니다(검색어가 달라도 같은 곳으로 묶임). */
export async function searchPlace(db: FavoritesDB, pick: PlacePick): Promise<Place> {
  return db.transaction('rw', db.places, async () => {
    const same = await db.places.where('[source+externalId]').equals([pick.source, pick.externalId]).first();
    if (same) return same;
    const p: Place = { id: newId(), source: pick.source, externalId: pick.externalId, name: cleanName(pick.name) };
    await db.places.add(p);
    return p;
  });
}

/**
 * 이름만 남긴 장소를 나중에 검색 결과로 연결합니다. 그 이름으로 남긴 기록이 모두 새 장소로 옮겨지고,
 * 이름만 장소는 지웁니다.
 */
export async function linkNamePlace(db: FavoritesDB, namePlaceId: string, pick: PlacePick): Promise<Place> {
  return db.transaction('rw', db.places, db.records, async () => {
    const old = await db.places.get(namePlaceId);
    if (!old || old.source !== 'name') throw new PlaceError('notFound');
    const target = await searchPlace(db, pick);
    await db.records.where('placeId').equals(old.id).modify({ placeId: target.id });
    await db.places.delete(old.id);
    return (await db.places.get(target.id))!;
  });
}

export function placeLabel(p: Place): string {
  return p.displayName || p.name;
}

/** 전에 간 곳: 기록에 쓰인 장소, 최근에 간 순. */
export async function recentPlaces(db: FavoritesDB, limit = 20): Promise<Place[]> {
  const recs = await db.records.orderBy('date').reverse().filter((r) => !!r.placeId).toArray();
  const seen: string[] = [];
  for (const r of recs) {
    if (!seen.includes(r.placeId!)) seen.push(r.placeId!);
    if (seen.length >= limit) break;
  }
  const ps = await db.places.bulkGet(seen);
  return ps.filter((p): p is Place => !!p);
}

/** 지도 주소: 국내(카카오)는 카카오맵, 해외·이름만은 구글 지도 검색. */
export function mapUrl(p: Place): string {
  if (p.source === 'kakao') return `https://place.map.kakao.com/${encodeURIComponent(p.externalId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`;
}
