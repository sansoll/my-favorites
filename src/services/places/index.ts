import { kakaoSearch } from './kakao';
import { osmSearch } from './osm';
import type { PlaceSearch } from './types';

export * from './types';

export interface PlaceServices { domestic: PlaceSearch; overseas: PlaceSearch }

let services: PlaceServices | null = null;

/** 장소 검색은 바꿔 끼울 수 있게 둡니다(DESIGN: 사용자가 늘면 다른 검색 서비스로). 테스트에서는 가짜를 넣습니다. */
export function getPlaceServices(): PlaceServices {
  if (!services) services = { domestic: kakaoSearch(import.meta.env.VITE_KAKAO_JS_KEY), overseas: osmSearch() };
  return services;
}

export function setPlaceServices(s: PlaceServices | null): void {
  services = s;
}

export function hasHangul(s: string): boolean {
  return /[가-힣ㄱ-ㅎ]/.test(s);
}
