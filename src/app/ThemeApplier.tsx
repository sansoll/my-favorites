import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { getDb } from '../data/db';
import { activeFontId, activeTheme } from '../data/repo/theme';
import { resolveTheme } from '../theme/color';
import { applyFont, applyTheme } from '../theme/themes';

/** 고른 테마와 글꼴을 앱 전체에 적용합니다. 앱을 껐다 켜도 저장된 설정을 따릅니다. */
export function ThemeApplier() {
  const theme = useLiveQuery(() => activeTheme(getDb()), []);
  const fontId = useLiveQuery(() => activeFontId(getDb()), []);

  useEffect(() => {
    if (theme) applyTheme(resolveTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (fontId === undefined) return;
    let alive = true;
    void loadFont(fontId).then((family) => { if (alive) applyFont(family); });
    return () => { alive = false; };
  }, [fontId]);
  return null;
}

const loaded = new Map<string, string>();

/** 저장한 글꼴 파일을 FontFace로 읽어 등록합니다. 읽지 못하면 기본 글꼴. */
export async function loadFont(id: string | null): Promise<string | null> {
  if (!id) return null;
  const hit = loaded.get(id);
  if (hit) return hit;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return null;
  const row = await getDb().blobs.get(id);
  if (!row || row.kind !== 'font') return null;
  try {
    const family = `UserFont-${id.slice(0, 8)}`;
    const face = new FontFace(family, await row.data.arrayBuffer());
    await face.load();
    document.fonts.add(face);
    loaded.set(id, family);
    return family;
  } catch {
    return null;
  }
}
