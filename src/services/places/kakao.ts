import { SearchError, type LatLng, type PlaceResult, type PlaceSearch } from './types';

/* 카카오 JavaScript SDK(services.Places). 키는 사이트 도메인에 묶여 있습니다(DESIGN). */
interface KakaoPlace { id: string; place_name: string; road_address_name: string; address_name: string; x?: string; y?: string }
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

/** SDK나 검색이 이 시간 안에 답하지 않으면 실패로 봅니다(멈춘 채로 두지 않기). */
export const KAKAO_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SearchError('blocked')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function loadSdk(key: string): Promise<KakaoGlobal> {
  if (loading) return loading;
  const p = new Promise<KakaoGlobal>((resolve, reject) => {
    const done = () => {
      // SDK 파일은 왔는데 kakao.maps가 없으면, 카카오가 이 키·도메인을 거절한 것입니다.
      const k = window.kakao;
      if (!k?.maps?.load) { reject(new SearchError('blocked')); return; }
      try {
        k.maps.load(() => (k.maps.services ? resolve(k) : reject(new SearchError('blocked'))));
      } catch {
        reject(new SearchError('blocked'));
      }
    };
    if (window.kakao?.maps) { done(); return; }
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = done;
    s.onerror = () => reject(new SearchError(navigator.onLine === false ? 'offline' : 'blocked'));
    document.head.appendChild(s);
  });
  loading = withTimeout(p, KAKAO_TIMEOUT_MS);
  // 실패하면 다음 검색 때 처음부터 다시 불러옵니다.
  loading.catch(() => { loading = null; });
  return loading;
}

export function toResults(data: KakaoPlace[]): PlaceResult[] {
  return data.map((p) => ({ source: 'kakao', externalId: p.id, name: p.place_name, sub: p.road_address_name || p.address_name }));
}

async function keyword(key: string | undefined, query: string): Promise<KakaoPlace[]> {
  if (!key) throw new SearchError('unavailable');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SearchError('offline');
  const k = await loadSdk(key);
  const run = new Promise<KakaoPlace[]>((resolve, reject) => {
    try {
      new k.maps.services.Places().keywordSearch(query, (data, status) => {
        if (status === k.maps.services.Status.OK) resolve(data);
        else if (status === k.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new SearchError('blocked'));
      }, { size: 15 });
    } catch {
      reject(new SearchError('blocked'));
    }
  });
  return withTimeout(run, KAKAO_TIMEOUT_MS);
}

export function kakaoSearch(key: string | undefined): PlaceSearch {
  return {
    async search(query) {
      return toResults(await keyword(key, query));
    },
    /** 지도에 찍을 좌표: 이름으로 다시 찾아 같은 번호의 좌표를 씁니다. 화면에서만 쓰고 저장하지 않습니다(DESIGN). */
    async locate(places) {
      const out = new Map<string, LatLng>();
      for (const p of places) {
        try {
          const hit = (await keyword(key, p.name)).find((x) => x.id === p.externalId);
          if (hit?.x && hit?.y) out.set(p.externalId, { lat: Number(hit.y), lng: Number(hit.x) });
        } catch (e) {
          if (e instanceof SearchError && e.reason !== 'failed') break;
        }
      }
      return out;
    },
  };
}
