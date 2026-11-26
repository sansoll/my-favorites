import { SearchError, type LatLng, type PlaceResult, type PlaceSearch } from './types';

/*
 * OpenStreetMap 검색(Nominatim). 사용 정책: 초당 1회 이하, 자동완성 금지 → `검색` 버튼에서만 부릅니다.
 * 결과는 번호와 이름만 저장합니다.
 */
export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const MIN_INTERVAL_MS = 1000;
export const NOMINATIM_LOOKUP = 'https://nominatim.openstreetmap.org/lookup';

interface NominatimItem { osm_type: string; osm_id: number; name?: string; display_name: string; lat?: string; lon?: string }

const osmKey = (x: NominatimItem) => `${x.osm_type.charAt(0).toUpperCase()}${x.osm_id}`;

export function toResults(items: NominatimItem[]): PlaceResult[] {
  return items.map((x) => {
    const parts = x.display_name.split(',').map((p) => p.trim());
    const name = x.name || parts[0];
    return { source: 'osm', externalId: osmKey(x), name, sub: parts.slice(1, 4).join(', ') };
  });
}

export function osmSearch(fetcher: typeof fetch = (...a) => fetch(...a), now: () => number = Date.now, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): PlaceSearch {
  let last = -Infinity;
  let chain: Promise<unknown> = Promise.resolve();
  // 요청이 겹쳐도 1초에 한 번을 넘지 않게 줄 세웁니다.
  const queue = <T>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const gap = last + MIN_INTERVAL_MS - now();
      if (gap > 0) await wait(gap);
      last = now();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SearchError('offline');
      return job();
    });
    chain = run.catch(() => undefined);
    return run;
  };
  const get = async (url: string, signal?: AbortSignal): Promise<NominatimItem[]> => {
    let res: Response;
    try {
      res = await fetcher(url, { signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new SearchError('offline');
    }
    if (!res.ok) throw new SearchError('failed');
    return (await res.json()) as NominatimItem[];
  };
  return {
    search(query, signal) {
      return queue(async () => toResults(await get(`${NOMINATIM}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '10', 'accept-language': 'ko,en' })}`, signal)));
    },
    /** 번호로 좌표를 한 번에(최대 50곳씩) 받아 옵니다. */
    async locate(places) {
      const out = new Map<string, LatLng>();
      const ids = [...new Set(places.map((p) => p.externalId).filter((id) => /^[NWR]\d+$/.test(id)))];
      for (let i = 0; i < ids.length; i += 50) {
        const items = await queue(() => get(`${NOMINATIM_LOOKUP}?${new URLSearchParams({ osm_ids: ids.slice(i, i + 50).join(','), format: 'jsonv2' })}`));
        for (const x of items) if (x.lat && x.lon) out.set(osmKey(x), { lat: Number(x.lat), lng: Number(x.lon) });
      }
      return out;
    },
  };
}
