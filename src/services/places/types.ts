import type { PlacePick } from '../../data/repo/places';

export interface PlaceResult extends PlacePick {
  /** 화면에만 보이는 주소(저장하지 않음) */
  sub: string;
}

export class SearchError extends Error {
  constructor(public reason: 'offline' | 'unavailable' | 'failed') {
    super(reason);
  }
}

export interface PlaceSearch {
  search(query: string, signal?: AbortSignal): Promise<PlaceResult[]>;
}
