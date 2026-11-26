import type { ThemeColors } from './themes';

/**
 * 색 계산(U9-1~3): 대비, 자동 글자색, 사진 색 뽑기, 테마 조합 6가지.
 * 화면 없이 계산만 하므로 촘촘히 테스트합니다.
 */

export const BLACK = '#1B1B1F';
export const WHITE = '#FFFFFF';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(h) || Number.isNaN(n)) throw new Error(`색이 아니에요: ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function isHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

/** a에서 b 쪽으로 t만큼 섞기(0이면 a, 1이면 b) */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t) as RGB);
}

/** WCAG 상대 휘도 */
export function luminance(hex: string): number {
  const c = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** 대비 수치(1~21) */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 검정·흰색 중 대비가 높은 쪽 */
export function bestText(bg: string): string {
  return contrast(BLACK, bg) >= contrast(WHITE, bg) ? BLACK : WHITE;
}

/** 글자 대비 기준: 4.5 이상 잘 보임, 3 이상 조금 흐림, 그 아래 잘 안 보임(알리기만 하고 막지 않음) */
export const CONTRAST_OK = 4.5;
export const CONTRAST_MID = 3;
export type Readability = 'ok' | 'mid' | 'low';
export function readability(ratio: number): Readability {
  return ratio >= CONTRAST_OK ? 'ok' : ratio >= CONTRAST_MID ? 'mid' : 'low';
}
export const READABILITY_LABEL: Record<Readability, string> = { ok: '잘 보여요', mid: '조금 흐려요', low: '잘 안 보여요' };

/** 저장된 테마(글자색 `auto` 가능)를 실제 색으로 풉니다. */
export interface ResolvedTheme extends ThemeColors {
  onAccent: string;
  dark: boolean;
  ratio: number;
}
export function resolveTheme(t: Omit<ThemeColors, 'text'> & { text: string }): ResolvedTheme {
  const text = t.text === 'auto' || !isHex(t.text) ? bestText(t.bg) : t.text;
  return { ...t, text, onAccent: bestText(t.accent), dark: luminance(t.bg) < 0.2, ratio: contrast(text, t.bg) };
}

// ───────────── U9-2 사진 색 뽑기 ─────────────

/** 이만큼 가까운 색은 하나로 합칩니다(RGB 거리). */
export const MERGE_DISTANCE = 48;
/** 색 뽑기 전에 사진을 이 크기 이하로 줄입니다. */
export const SAMPLE_SIZE = 64;

export function distance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function saturation([r, g, b]: RGB): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * RGBA 픽셀에서 대표 색을 뽑습니다(많은 순, 최대 max개).
 * 1) 투명한 픽셀은 빼고 2) 채널마다 32단계로 묶어 세고 3) 가까운 색은 많은 쪽으로 합칩니다.
 */
export function extractColors(pixels: Uint8ClampedArray | number[], max = 5): string[] {
  const buckets = new Map<number, { n: number; sum: [number, number, number] }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = buckets.get(key);
    if (e) { e.n++; e.sum[0] += r; e.sum[1] += g; e.sum[2] += b; } else buckets.set(key, { n: 1, sum: [r, g, b] });
  }
  const list = [...buckets.values()].map((e) => ({ n: e.n, c: e.sum.map((v) => v / e.n) as RGB })).sort((a, b) => b.n - a.n);
  const merged: { n: number; c: RGB }[] = [];
  for (const x of list) {
    const near = merged.find((m) => distance(m.c, x.c) < MERGE_DISTANCE);
    if (near) {
      const n = near.n + x.n;
      near.c = near.c.map((v, i) => (v * near.n + x.c[i] * x.n) / n) as RGB;
      near.n = n;
    } else merged.push({ ...x });
  }
  // 아주 적은 색(1% 미만)은 버리되 한 가지는 남깁니다.
  const total = merged.reduce((s, m) => s + m.n, 0);
  const kept = merged.filter((m, i) => i === 0 || m.n / total >= 0.01).sort((a, b) => b.n - a.n).slice(0, max);
  return kept.map((m) => rgbToHex(m.c));
}

/** 큰 사진은 긴 변이 size 이하가 되게 줄일 크기 */
export function sampleSize(w: number, h: number, size = SAMPLE_SIZE): { w: number; h: number } {
  const k = Math.min(1, size / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// ───────────── U9-3 테마 조합 6가지 ─────────────

export interface Combo { label: string; bg: string; surface: string; accent: string; accent2: string }

/** 뽑은 색으로 테마 조합 6가지. 색이 한 가지뿐이면 전부 그 색인 조합 하나. */
export function themeCombos(colors: string[]): Combo[] {
  if (colors.length === 0) return [];
  if (colors.length === 1) {
    const c = colors[0];
    return [{ label: '사진 그대로', bg: c, surface: c, accent: c, accent2: c }];
  }
  const g = (k: number) => colors[k] ?? colors[0];
  // 강조는 가장 선명한 색
  const main = colors.slice().sort((a, b) => saturation(hexToRgb(b)) - saturation(hexToRgb(a)))[0];
  const others = colors.filter((c) => c !== main);
  const second = others[0] ?? g(1);
  const third = others[1] ?? second;
  const light = colors.slice().sort((a, b) => luminance(b) - luminance(a))[0];
  const dark = colors.slice().sort((a, b) => luminance(a) - luminance(b))[0];
  return [
    { label: '추천', bg: mix(light, WHITE, 0.85), surface: mix(light, WHITE, 0.55), accent: main, accent2: second },
    { label: '부드럽게', bg: mix(light, WHITE, 0.94), surface: mix(main, WHITE, 0.85), accent: second, accent2: main },
    { label: '진하게', bg: mix(main, WHITE, 0.72), surface: mix(main, WHITE, 0.5), accent: dark, accent2: third },
    { label: '어둡게', bg: mix(dark, '#000000', 0.55), surface: mix(dark, '#000000', 0.25), accent: mix(main, WHITE, 0.25), accent2: second },
    { label: '또렷하게', bg: WHITE, surface: mix(main, WHITE, 0.9), accent: dark, accent2: main },
    { label: '다른 색 중심', bg: mix(third, WHITE, 0.86), surface: mix(third, WHITE, 0.62), accent: third, accent2: main },
  ];
}
