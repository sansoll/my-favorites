import { KAKAO_TIMEOUT_MS } from './kakao';

/** 불러온 SDK를 모듈이 기억하므로, 시험마다 새로 불러옵니다. */
async function fresh() {
  vi.resetModules();
  const m = await import('./kakao');
  const t = await import('./types');
  return { kakaoSearch: m.kakaoSearch, SearchError: t.SearchError };
}

/** 카카오 SDK 스크립트를 흉내 냅니다: head에 붙는 순간 onload를 부르고, 그때 window.kakao를 정해 둡니다. */
function fakeSdk(kakao: unknown) {
  const orig = document.head.appendChild.bind(document.head);
  return vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(n: T): T => {
    if (n instanceof HTMLScriptElement && n.src.includes('dapi.kakao.com')) {
      (window as unknown as { kakao?: unknown }).kakao = kakao;
      queueMicrotask(() => n.onload?.(new Event('load')));
      return n;
    }
    return orig(n);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as unknown as { kakao?: unknown }).kakao;
});

describe('카카오 SDK 불러오기', () => {
  it('SDK는 왔는데 kakao.maps가 없으면(도메인·앱 설정 거절) 멈추지 않고 blocked', async () => {
    const { kakaoSearch } = await fresh();
    fakeSdk({});
    await expect(kakaoSearch('k1').search('고척돔')).rejects.toMatchObject({ reason: 'blocked' });
  });

  it('검색이 답하지 않으면 시간이 지나 blocked, 다음 검색은 처음부터 다시 시도', async () => {
    const { kakaoSearch, SearchError } = await fresh();
    vi.useFakeTimers();
    const Places = class { keywordSearch() { /* 답 없음 */ } };
    fakeSdk({ maps: { load: (cb: () => void) => cb(), services: { Places, Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' } } } });
    const p = kakaoSearch('k2').search('고척돔');
    const done = expect(p).rejects.toBeInstanceOf(SearchError);
    await vi.advanceTimersByTimeAsync(KAKAO_TIMEOUT_MS + 10);
    await done;
  });

  it('정상이면 이름·주소를 결과로', async () => {
    const { kakaoSearch } = await fresh();
    const Places = class { keywordSearch(_q: string, cb: (d: unknown[], s: string) => void) { cb([{ id: '1', place_name: '고척스카이돔', road_address_name: '서울 구로구', address_name: '' }], 'OK'); } };
    fakeSdk({ maps: { load: (cb: () => void) => cb(), services: { Places, Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' } } } });
    await expect(kakaoSearch('k3').search('고척돔')).resolves.toEqual([{ source: 'kakao', externalId: '1', name: '고척스카이돔', sub: '서울 구로구' }]);
  });
});
