import { SearchError, type PlaceResult, type PlaceSearch } from './types';

/* 카카오 JavaScript SDK(services.Places). 키는 사이트 도메인에 묶여 있습니다(DESIGN). */
interface KakaoPlace { id: string; place_name: string; road_address_name: string; address_name: string }
interface KakaoGlobal {
  maps: {
    load(cb: () => void): void;
    services: {
      Places: new () => { keywordSearch(q: string, cb: (data: KakaoPlace[], status: string) => void, opts?: { size?: number }): void };
      Status: { OK: string; ZERO_RESULT: string; ERROR: string };
    };
  };
}
declare global { interface Window { kakao?: KakaoGlobal } }

let loading: Promise<KakaoGlobal> | null = null;

function loadSdk(key: string): Promise<KakaoGlobal> {
  if (loading) return loading;
  loading = new Promise<KakaoGlobal>((resolve, reject) => {
    const done = () => window.kakao!.maps.load(() => resolve(window.kakao!));
    if (window.kakao?.maps) { done(); return; }
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = done;
    s.onerror = () => { loading = null; reject(new SearchError('offline')); };
    document.head.appendChild(s);
  });
  return loading;
}

export function toResults(data: KakaoPlace[]): PlaceResult[] {
  return data.map((p) => ({ source: 'kakao', externalId: p.id, name: p.place_name, sub: p.road_address_name || p.address_name }));
}

export function kakaoSearch(key: string | undefined): PlaceSearch {
  return {
    async search(query) {
      if (!key) throw new SearchError('unavailable');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SearchError('offline');
      const k = await loadSdk(key);
      return new Promise((resolve, reject) => {
        new k.maps.services.Places().keywordSearch(query, (data, status) => {
          if (status === k.maps.services.Status.OK) resolve(toResults(data));
          else if (status === k.maps.services.Status.ZERO_RESULT) resolve([]);
          else reject(new SearchError('failed'));
        }, { size: 15 });
      });
    },
  };
}
