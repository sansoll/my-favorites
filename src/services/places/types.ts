import type { PlacePick } from '../../data/repo/places';

export interface PlaceResult extends PlacePick {
  /** 화면에만 보이는 주소(저장하지 않음) */
  sub: string;
}

export class SearchError extends Error {
  constructor(public reason: 'offline' | 'unavailable' | 'failed' | 'blocked') {
    super(reason);
  }
}

export interface LatLng { lat: number; lng: number }

export interface PlaceSearch {
  search(query: string, signal?: AbortSignal): Promise<PlaceResult[]>;
  /** 장소 번호 → 좌표. 지도 화면에서만 쓰고 저장하지 않습니다. 못 찾은 곳은 빠집니다. */
  locate?(places: { externalId: string; name: string }[]): Promise<Map<string, LatLng>>;
}
