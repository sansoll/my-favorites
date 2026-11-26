import { useEffect, useState } from 'react';
import type { Place } from '../../data/types';
import { getPlaceServices, type LatLng } from '../../services/places';

/** 이번 실행 동안만 기억하는 좌표(저장하지 않음). 못 찾은 곳은 null. */
const cache = new Map<string, LatLng | null>();
const key = (p: Place) => `${p.source}:${p.externalId}`;

export function clearVisitCoords(): void {
  cache.clear();
}

/** 장소들의 좌표를 화면에 쓸 만큼만 찾아 옵니다. 카카오는 이름으로 다시 찾아 번호가 같은 곳, OSM은 번호로. */
export function useVisitCoords(places: Place[]): { coords: Map<string, LatLng>; loading: boolean } {
  const [, bump] = useState(0);
  const [loading, setLoading] = useState(false);
  const want = places.filter((p) => p.source !== 'name' && !cache.has(key(p)));
  const sig = want.map(key).sort().join('|');

  useEffect(() => {
    if (!sig) return;
    let live = true;
    const svc = getPlaceServices();
    const kakao = want.filter((p) => p.source === 'kakao').slice(0, 30);
    const osm = want.filter((p) => p.source === 'osm');
    setLoading(true);
    const job = async (src: 'kakao' | 'osm', list: Place[]) => {
      if (!list.length) return;
      const s = src === 'kakao' ? svc.domestic : svc.overseas;
      let got = new Map<string, LatLng>();
      try { got = (await s.locate?.(list.map((p) => ({ externalId: p.externalId, name: p.name })))) ?? got; } catch { /* 못 찾으면 목록에만 */ }
      for (const p of list) cache.set(key(p), got.get(p.externalId) ?? null);
    };
    void Promise.all([job('kakao', kakao), job('osm', osm)]).finally(() => { if (live) { setLoading(false); bump((n) => n + 1); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const coords = new Map<string, LatLng>();
  for (const p of places) { const c = cache.get(key(p)); if (c) coords.set(p.id, c); }
  return { coords, loading: loading || want.length > 0 };
}
