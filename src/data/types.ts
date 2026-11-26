import type { DateStr } from '../domain/date';

/** 모든 항목은 문자열 id를 가집니다. 기록은 이름이 아니라 id로 대상·분류·세부를 가리킵니다. */
export interface Target {
  id: string;
  name: string;
  color: string;
  photoId?: string;
  order: number;
  presetId?: string;
  isEtc: boolean;
}

export interface Category {
  id: string;
  targetId: string;
  name: string;
  order: number;
  isEtc: boolean;
}

export interface Detail {
  id: string;
  categoryId: string;
  name: string;
  order: number;
  isEtc: boolean;
}

export interface SpendRecord {
  id: string;
  date: DateStr;
  targetId: string;
  categoryId: string;
  detailId: string;
  etcText: string;
  paid: number;
  refund: number;
  memo: string;
  placeId?: string;
  recurringId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Recurring {
  id: string;
  targetId: string;
  categoryId: string;
  detailId: string;
  amount: number;
  day: number;
  enabled: boolean;
  /** 이 달(YYYY-MM)까지 기록을 만들었음 */
  lastMonth: string;
}

export interface Place {
  id: string;
  source: 'kakao' | 'osm' | 'name';
  /** 카카오·OSM 장소 번호. 이름만 남긴 장소는 빈 문자열 */
  externalId: string;
  name: string;
  /** 사용자가 바꾼 보이는 이름 */
  displayName?: string;
}

export interface PresetItem {
  name: string;
  details: string[];
}

export interface Preset {
  id: string;
  name: string;
  items: PresetItem[];
  order: number;
}

export interface SongMark {
  line: number;
  word: number;
  color: string;
}

export interface SongExtra {
  id: string;
  line: number;
  word: number;
  position: 'before' | 'after' | 'below';
  text: string;
  color: string;
}

export interface Song {
  id: string;
  targetId: string;
  title: string;
  lyrics: string;
  layer: { marks: SongMark[]; extras: SongExtra[] };
  links: { name: string; url: string }[];
  createdAt: number;
}

export interface SongOpen {
  id: string;
  songId: string;
  at: number;
}

export interface CheckCover {
  all: string | null;
  months: Record<string, string | null>;
  bg: boolean;
}

export interface CheckItem {
  id: string;
  targetId: string;
  name: string;
  color?: string;
  on: boolean;
  order: number;
  /** 달력 표지: 사진(blobs id). months의 달 설정이 all보다 먼저. bg는 사진 창문 보기 */
  cover?: CheckCover;
  notifyApp?: string;
}

export interface CheckDay {
  id: string;
  itemId: string;
  date: DateStr;
  count?: number;
  source: 'manual' | 'auto';
  dismissed?: boolean;
}

export interface Theme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  accent: string;
  accent2: string;
  text: 'auto' | string;
}

export interface CategoryColor {
  /** 공백을 뺀 분류 이름 */
  name: string;
  color: string;
}

export interface Blob_ {
  id: string;
  kind: 'photo' | 'font';
  name: string;
  data: Blob;
  /** 사진의 픽셀 크기(줄인 뒤) */
  width?: number;
  height?: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
