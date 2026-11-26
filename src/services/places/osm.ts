import { SearchError, type PlaceResult, type PlaceSearch } from './types';

/*
 * OpenStreetMap 검색(Nominatim). 사용 정책: 초당 1회 이하, 자동완성 금지 → `검색` 버튼에서만 부릅니다.
 * 결과는 번호와 이름만 저장합니다.
 */
export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const MIN_INTERVAL_MS = 1000;

interface NominatimItem { osm_type: string; osm_id: number; name?: string; display_name: string }

export function toResults(items: NominatimItem[]): PlaceResult[] {
  return items.map((x) => {
    const parts = x.display_name.split(',').map((p) => p.trim());
    const name = x.name || parts[0];
    return { source: 'osm', externalId: `${x.osm_type.charAt(0).toUpperCase()}${x.osm_id}`, name, sub: parts.slice(1, 4).join(', ') };
  });
}

export function osmSearch(fetcher: typeof fetch = (...a) => fetch(...a), now: () => number = Date.now, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): PlaceSearch {
  let last = -Infinity;
  let chain: Promise<unknown> = Promise.resolve();
  return {
    search(query, signal) {
      // 요청이 겹쳐도 1초에 한 번을 넘지 않게 줄 세웁니다.
      const run = chain.then(async () => {
        const gap = last + MIN_INTERVAL_MS - now();
        if (gap > 0) await wait(gap);
        last = now();
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SearchError('offline');
        const url = `${NOMINATIM}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '10', 'accept-language': 'ko,en' })}`;
        let res: Response;
        try {
          res = await fetcher(url, { signal, headers: { Accept: 'application/json' } });
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw e;
          throw new SearchError('offline');
        }
        if (!res.ok) throw new SearchError('failed');
        return toResults((await res.json()) as NominatimItem[]);
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };
}
