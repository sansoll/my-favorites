import { newId, type FavoritesDB } from '../db';
import { getSetting, setSetting } from '../settings';
import type { Blob_, Theme } from '../types';
import { BUILTIN_THEMES, LEGACY_THEME_IDS } from '../../theme/themes';
import { isHex } from '../../theme/color';
import { nameKey } from '../../domain/name';

/** 테마·글꼴·꾸미기 저장(U9-4~6). 라이트·다크 모드는 코드에 내장하고, 사진 테마만 `themes`에 저장합니다. */

export const THEME_KEY = 'theme';
export const BUILTIN_TEXT_KEY = 'builtinThemeText';
export const FONT_KEY = 'font';

export type BuiltinId = keyof typeof BUILTIN_THEMES;
const BUILTIN_NAMES: Record<BuiltinId, string> = { light: '라이트 모드', dark: '다크 모드' };

export interface ThemeEntry extends Theme { builtin: boolean }

export async function listThemes(db: FavoritesDB): Promise<ThemeEntry[]> {
  const texts = await getSetting<Partial<Record<BuiltinId, string>>>(db, BUILTIN_TEXT_KEY, {});
  const builtins = (Object.keys(BUILTIN_THEMES) as BuiltinId[]).map((id) => ({
    id, name: BUILTIN_NAMES[id], ...BUILTIN_THEMES[id], text: texts[id] ?? 'auto', builtin: true,
  }));
  const saved = (await db.themes.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  return [...builtins, ...saved.map((t) => ({ ...t, builtin: false }))];
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export async function activeThemeId(db: FavoritesDB): Promise<string> {
  const id = await getSetting<string | null>(db, THEME_KEY, null);
  // 아직 고른 적이 없으면 폰의 다크 모드 설정을 따릅니다.
  if (!id) return systemPrefersDark() ? 'dark' : 'light';
  return LEGACY_THEME_IDS[id] ?? id;
}

/** 지금 쓰는 테마. 지운 테마를 가리키면 라이트. */
export async function activeTheme(db: FavoritesDB): Promise<ThemeEntry> {
  const [list, id] = await Promise.all([listThemes(db), activeThemeId(db)]);
  return list.find((t) => t.id === id) ?? list[0];
}

export async function applyThemeById(db: FavoritesDB, id: string): Promise<void> {
  await setSetting(db, THEME_KEY, id);
}

export interface ThemeDraft { bg: string; surface: string; accent: string; accent2: string; text: string }

function checkDraft(d: ThemeDraft): void {
  for (const k of ['bg', 'surface', 'accent', 'accent2'] as const) if (!isHex(d[k])) throw new Error(`색이 아니에요: ${k}`);
  if (d.text !== 'auto' && !isHex(d.text)) throw new Error('글자색이 아니에요');
}

/** 사진 테마 저장: 이름은 `사진 테마 n`(비어 있는 가장 작은 번호), 바로 적용합니다. */
export async function savePhotoTheme(db: FavoritesDB, draft: ThemeDraft, apply = true): Promise<Theme> {
  checkDraft(draft);
  const names = new Set((await db.themes.toArray()).map((t) => t.name));
  let n = 1;
  while (names.has(`사진 테마 ${n}`)) n++;
  const theme: Theme = { id: newId(), name: `사진 테마 ${n}`, ...draft };
  await db.themes.add(theme);
  if (apply) await applyThemeById(db, theme.id);
  return theme;
}

/** 글자색: `auto` 또는 직접 고른 색 */
export async function setThemeText(db: FavoritesDB, id: string, text: string): Promise<void> {
  if (text !== 'auto' && !isHex(text)) throw new Error('글자색이 아니에요');
  if (id in BUILTIN_THEMES) {
    const cur = await getSetting<Record<string, string>>(db, BUILTIN_TEXT_KEY, {});
    await setSetting(db, BUILTIN_TEXT_KEY, { ...cur, [id]: text });
  } else {
    await db.themes.update(id, { text });
  }
}

export async function deleteTheme(db: FavoritesDB, id: string): Promise<void> {
  if (id in BUILTIN_THEMES) return;
  await db.themes.delete(id);
  if ((await activeThemeId(db)) === id) await applyThemeById(db, 'light');
}

// ───────────── U9-5 글꼴 ─────────────

export const FONT_MAX_BYTES = 20 * 1024 * 1024;
export const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2'] as const;

export class FontError extends Error {
  constructor(public reason: 'type' | 'size' | 'broken') { super(reason); }
}

/** 파일 앞 4바이트로 글꼴인지 봅니다(TrueType, OpenType, WOFF, WOFF2). */
export function isFontSignature(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  const tag = String.fromCharCode(head[0], head[1], head[2], head[3]);
  return (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) || ['true', 'OTTO', 'wOFF', 'wOF2', 'ttcf'].includes(tag);
}

async function readHead(file: Blob): Promise<Uint8Array> {
  const part = file.slice(0, 4);
  if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer());
  return new Uint8Array(await new Response(part).arrayBuffer());
}

/** 글꼴 파일 검사 후 저장. 이름은 확장자를 뺀 파일 이름. */
export async function addFont(db: FavoritesDB, file: File): Promise<Blob_> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(FONT_EXTS as readonly string[]).includes(ext)) throw new FontError('type');
  if (file.size > FONT_MAX_BYTES) throw new FontError('size');
  if (!isFontSignature(await readHead(file))) throw new FontError('type');
  const row: Blob_ = { id: newId(), kind: 'font', name: file.name.replace(/\.[^.]+$/, '') || '글꼴', data: file };
  await db.blobs.add(row);
  return row;
}

export async function listFonts(db: FavoritesDB): Promise<Blob_[]> {
  return db.blobs.where('kind').equals('font').toArray();
}

export async function activeFontId(db: FavoritesDB): Promise<string | null> {
  const id = await getSetting<string | null>(db, FONT_KEY, null);
  if (!id) return null;
  return (await db.blobs.get(id)) ? id : null;
}

export async function setFont(db: FavoritesDB, id: string | null): Promise<void> {
  await setSetting(db, FONT_KEY, id);
}

/** 글꼴 지우기. 쓰던 글꼴이면 기본 글꼴로 돌아갑니다. */
export async function deleteFont(db: FavoritesDB, id: string): Promise<void> {
  await db.transaction('rw', db.blobs, db.settings, async () => {
    await db.blobs.delete(id);
    if ((await getSetting<string | null>(db, FONT_KEY, null)) === id) await setSetting(db, FONT_KEY, null);
  });
}

// ───────────── U9-6 대상 꾸미기, 분류 색 ─────────────

export async function setTargetColor(db: FavoritesDB, targetId: string, color: string): Promise<void> {
  if (!isHex(color)) throw new Error('색이 아니에요');
  await db.targets.update(targetId, { color });
}

/** 대상 사진 넣기·바꾸기·빼기. 다른 곳에서 안 쓰는 이전 사진은 지웁니다. */
export async function setTargetPhoto(db: FavoritesDB, targetId: string, photoId: string | null): Promise<void> {
  await db.transaction('rw', db.targets, db.blobs, db.checkItems, async () => {
    const t = await db.targets.get(targetId);
    if (!t) return;
    const old = t.photoId;
    await db.targets.update(targetId, { photoId: photoId ?? undefined });
    if (old && old !== photoId) {
      const usedByTarget = (await db.targets.filter((x) => x.photoId === old).count()) > 0;
      const usedByCover = (await db.checkItems.filter((c) => !!c.cover && (c.cover.all === old || Object.values(c.cover.months).includes(old))).count()) > 0;
      if (!usedByTarget && !usedByCover) await db.blobs.delete(old);
    }
  });
}

/** 같은 이름(공백 무시)의 분류는 같은 색 */
export async function setCategoryColor(db: FavoritesDB, name: string, color: string): Promise<void> {
  if (!isHex(color)) throw new Error('색이 아니에요');
  await db.categoryColors.put({ name: nameKey(name), color });
}

export async function categoryColorMap(db: FavoritesDB): Promise<Map<string, string>> {
  return new Map((await db.categoryColors.toArray()).map((c) => [c.name, c.color]));
}
