/** 테마는 배경·카드·강조·보조 강조·글자 다섯 가지 색입니다. 라이트·흑백은 코드에 내장합니다. */
export interface ThemeColors {
  bg: string;
  surface: string;
  accent: string;
  accent2: string;
  text: string;
}

export const LIGHT: ThemeColors = {
  bg: '#FFFFFF',
  surface: '#F5F5F7',
  accent: '#5B4CDB',
  accent2: '#D9487A',
  text: '#1B1B1F',
};

export const MONO: ThemeColors = {
  bg: '#FFFFFF',
  surface: '#F2F2F2',
  accent: '#1B1B1F',
  accent2: '#5F6068',
  text: '#1B1B1F',
};

export const BUILTIN_THEMES = { light: LIGHT, mono: MONO } as const;

/** 테마 색을 CSS 변수로 바꿔 끼웁니다. */
export function applyTheme(t: ThemeColors, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--surface', t.surface);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent2', t.accent2);
  root.style.setProperty('--text', t.text);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.accent);
}
