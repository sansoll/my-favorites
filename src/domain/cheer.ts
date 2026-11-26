import type { SongExtra, SongMark } from '../data/types';

/**
 * 응원법 규칙(U8-1~3, U8-7). 가사는 원문 그대로 두고, 줄·단어 번호(0부터)로 위치를 가리킵니다.
 */

export interface Layer { marks: SongMark[]; extras: SongExtra[] }
export const EMPTY_LAYER: Layer = { marks: [], extras: [] };

/** 떼창 색 4가지. 공연장 모드는 어두운 화면에 맞춘 진한 색을 씁니다. */
export const CHEER_COLORS = [
  { key: 'y', name: '노랑', color: '#FFE08A', stage: '#FFD84D' },
  { key: 'p', name: '분홍', color: '#FFD3DE', stage: '#FF8FB0' },
  { key: 'b', name: '하늘', color: '#CDE8FF', stage: '#7CC4FF' },
  { key: 'g', name: '연두', color: '#D6F5C9', stage: '#8BE07A' },
] as const;

export function stageColor(color: string): string {
  return CHEER_COLORS.find((c) => c.color === color)?.stage ?? color;
}

// ───────────── U8-1 가사 나누기 ─────────────

export interface LyricLine {
  /** 줄 번호(0부터). 빈 줄도 번호를 가집니다. */
  index: number;
  text: string;
  words: string[];
}

/** 줄은 줄바꿈으로, 단어는 공백(여러 개여도 하나)으로 나눕니다. 빈 줄은 남깁니다. */
export function splitLyrics(lyrics: string): LyricLine[] {
  return lyrics.replace(/\r\n?/g, '\n').split('\n').map((text, index) => ({ index, text, words: splitWords(text) }));
}

export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

/** 줄을 비교할 때는 단어만 봅니다(앞뒤·사이 공백 차이는 같은 줄). */
export function lineKey(line: string): string {
  return splitWords(line).join(' ');
}

/** 붙여넣은 가사 정리: 줄 끝 공백과 앞뒤 빈 줄만 뺍니다. */
export function cleanLyrics(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
}

// ───────────── U8-2 보기별 표시 ─────────────

export type ViewMode = 'cheer' | 'orig' | 'memo';
export const VIEW_LABELS: Record<ViewMode, string> = { cheer: '응원법', orig: '원본', memo: '외우기' };

/** 떼창 단어: color(색 강조) / plain(일반 가사) / covered(칸으로 가림) */
export type MarkShow = 'color' | 'plain' | 'covered';
/** 추가 응원: show(표시) / hidden(숨김) / covered(칸으로 가림) */
export type ExtraShow = 'show' | 'hidden' | 'covered';

export function markShow(mode: ViewMode, opened = false): MarkShow {
  if (mode === 'cheer') return 'color';
  if (mode === 'orig') return 'plain';
  return opened ? 'color' : 'covered';
}

export function extraShow(mode: ViewMode, opened = false): ExtraShow {
  if (mode === 'cheer') return 'show';
  if (mode === 'orig') return 'hidden';
  return opened ? 'show' : 'covered';
}

/** 외우기에서 여닫는 칸의 열쇠 */
export const markKey = (line: number, word: number) => `m${line}-${word}`;
export const extraKey = (id: string) => `x${id}`;

export function allCoverKeys(layer: Layer): string[] {
  return [...layer.marks.map((m) => markKey(m.line, m.word)), ...layer.extras.map((x) => extraKey(x.id))];
}

// ───────────── 층 고치기 ─────────────

/** 같은 단어를 같은 색으로 다시 누르면 지우고, 다른 색이면 바꿉니다. color가 null이면 지웁니다. */
export function toggleMark(layer: Layer, line: number, word: number, color: string | null): Layer {
  const rest = layer.marks.filter((m) => !(m.line === line && m.word === word));
  const had = layer.marks.find((m) => m.line === line && m.word === word);
  if (color === null || had?.color === color) return { ...layer, marks: rest };
  return { ...layer, marks: [...rest, { line, word, color }].sort((a, b) => a.line - b.line || a.word - b.word) };
}

/** 한 단어 둘레의 추가 응원(앞 → 단어 → 뒤), 줄 아래 응원 */
export function extrasAt(layer: Layer, line: number) {
  const xs = layer.extras.filter((x) => x.line === line);
  return {
    before: (w: number) => xs.filter((x) => x.position === 'before' && x.word === w),
    after: (w: number) => xs.filter((x) => x.position === 'after' && x.word === w),
    below: xs.filter((x) => x.position === 'below'),
  };
}

// ───────────── U8-3 가사를 고친 뒤 ─────────────

export interface Relayout {
  layer: Layer;
  /** 새 가사에서 바뀌었거나 새로 생긴 줄(빈 줄 제외) */
  changed: number[];
  /** 바뀐 줄에 있다가 지워진 떼창·추가 응원 수 */
  dropped: number;
}

/**
 * 줄 단위로 비교(가장 긴 공통 부분)해서, 바뀌지 않은 줄의 응원법은 새 줄 번호로 옮기고
 * 바뀐 줄의 응원법은 지운 뒤 그 줄을 알려 줍니다.
 */
export function relayout(oldLyrics: string, newLyrics: string, layer: Layer): Relayout {
  const a = splitLyrics(oldLyrics).map((l) => lineKey(l.text));
  const b = splitLyrics(newLyrics).map((l) => lineKey(l.text));
  // LCS 표
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const map = new Map<number, number>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { map.set(i, j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const kept = new Set(map.values());
  const changed = b.map((t, j) => (t && !kept.has(j) ? j : -1)).filter((j) => j >= 0);
  let dropped = 0;
  const marks: SongMark[] = [];
  for (const mk of layer.marks) {
    const to = map.get(mk.line);
    if (to === undefined) dropped++; else marks.push({ ...mk, line: to });
  }
  const extras: SongExtra[] = [];
  for (const x of layer.extras) {
    const to = map.get(x.line);
    if (to === undefined) dropped++; else extras.push({ ...x, line: to });
  }
  return { layer: { marks, extras }, changed, dropped };
}

// ───────────── U8-7 펼친 횟수 ─────────────

export const OPEN_GAP_MS = 30 * 60 * 1000;

/** 같은 곡은 30분 안에 다시 열면 세지 않습니다. */
export function shouldCountOpen(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= OPEN_GAP_MS;
}

// ───────────── 곡 목록 ─────────────

/** 제목 검색: 공백·대소문자 무시 */
export function matchTitle(title: string, q: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  return norm(title).includes(norm(q));
}
