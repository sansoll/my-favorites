import type { FavoritesDB } from '../db';
import { freshDb } from '../../test/db';
import { addTarget, ensureInitialData } from './lists';
import { savePhoto, addCheckItem, setCover } from './checks';
import {
  activeFontId, activeTheme, addFont, applyThemeById, categoryColorMap, deleteFont, deleteTheme, FONT_MAX_BYTES, FontError, isFontSignature, listFonts, listThemes,
  savePhotoTheme, setCategoryColor, setFont, setTargetColor, setTargetPhoto, setThemeText,
} from './theme';

let db: FavoritesDB;
beforeEach(async () => { db = freshDb(); await ensureInitialData(db); });

const draft = { bg: '#FDF3F7', surface: '#FADDE8', accent: '#8E7BE0', accent2: '#5A3E9E', text: 'auto' };
const fontFile = (name: string, head: number[], size = 100) => {
  const bytes = new Uint8Array(size); bytes.set(head);
  return new File([bytes], name);
};

describe('테마 저장·적용 (U9-4)', () => {
  it('기본은 라이트 모드, 다크 모드 적용, 사진 테마는 `사진 테마 n`으로 저장하고 바로 적용', async () => {
    expect((await activeTheme(db)).id).toBe('light');
    expect((await listThemes(db)).map((t) => t.name)).toEqual(['라이트 모드', '다크 모드']);
    await applyThemeById(db, 'dark');
    expect((await activeTheme(db)).name).toBe('다크 모드');
    // 예전 흑백(mono)을 쓰던 사람은 다크 모드로
    await applyThemeById(db, 'mono');
    expect((await activeTheme(db)).id).toBe('dark');
    const t1 = await savePhotoTheme(db, draft);
    const t2 = await savePhotoTheme(db, draft);
    expect([t1.name, t2.name]).toEqual(['사진 테마 1', '사진 테마 2']);
    expect((await activeTheme(db)).id).toBe(t2.id);
    await deleteTheme(db, t1.id);
    expect((await savePhotoTheme(db, draft, false)).name).toBe('사진 테마 1');
  });

  it('쓰던 테마를 지우면 라이트로, 잘못된 색은 거부', async () => {
    const t = await savePhotoTheme(db, draft);
    await deleteTheme(db, t.id);
    expect((await activeTheme(db)).id).toBe('light');
    await expect(savePhotoTheme(db, { ...draft, bg: 'red' })).rejects.toThrow();
  });

  it('글자색: 내장 테마와 사진 테마 모두 auto 또는 직접', async () => {
    await setThemeText(db, 'light', '#333333');
    const t = await savePhotoTheme(db, draft);
    await setThemeText(db, t.id, '#111111');
    const list = await listThemes(db);
    expect(list.find((x) => x.id === 'light')?.text).toBe('#333333');
    expect(list.find((x) => x.id === t.id)?.text).toBe('#111111');
    await expect(setThemeText(db, 'dark', 'javascript:')).rejects.toThrow();
  });
});

describe('글꼴 (U9-5)', () => {
  it('글꼴이 아닌 파일 거부(확장자, 파일 앞부분), 크기 상한', async () => {
    await expect(addFont(db, fontFile('a.png', [0x89, 0x50, 0x4e, 0x47]))).rejects.toMatchObject({ reason: 'type' });
    await expect(addFont(db, fontFile('fake.ttf', [0x3c, 0x68, 0x74, 0x6d]))).rejects.toBeInstanceOf(FontError);
    const big = { name: 'big.woff2', size: FONT_MAX_BYTES + 1, slice: () => new Blob() } as unknown as File;
    await expect(addFont(db, big)).rejects.toMatchObject({ reason: 'size' });
    expect(isFontSignature(new Uint8Array([0, 1, 0, 0]))).toBe(true);
    expect(isFontSignature(new TextEncoder().encode('OTTO'))).toBe(true);
    expect(isFontSignature(new TextEncoder().encode('wOF2'))).toBe(true);
  });

  it('넣고 쓰고, 지우면 기본 글꼴', async () => {
    const f = await addFont(db, fontFile('내 글꼴.woff2', [...new TextEncoder().encode('wOF2')]));
    expect(f.name).toBe('내 글꼴');
    expect((await listFonts(db)).map((x) => x.id)).toEqual([f.id]);
    await setFont(db, f.id);
    expect(await activeFontId(db)).toBe(f.id);
    await deleteFont(db, f.id);
    expect(await activeFontId(db)).toBeNull();
    expect(await listFonts(db)).toEqual([]);
  });
});

describe('대상 꾸미기, 분류 색 (U9-6)', () => {
  it('대상 색·사진, 안 쓰는 이전 사진은 지움(달력 표지로 쓰면 남김)', async () => {
    const a = await addTarget(db, '가수 A');
    await setTargetColor(db, a.id, '#123456');
    const p1 = await savePhoto(db, new Blob(['1']), 1, 1);
    const p2 = await savePhoto(db, new Blob(['2']), 1, 1);
    await setTargetPhoto(db, a.id, p1);
    expect((await db.targets.get(a.id))).toMatchObject({ color: '#123456', photoId: p1 });
    await setTargetPhoto(db, a.id, p2);
    expect(await db.blobs.get(p1)).toBeUndefined();
    const item = await addCheckItem(db, a.id, '버블');
    await setCover(db, item.id, p2, 'all', '2026-11');
    await setTargetPhoto(db, a.id, null);
    expect((await db.targets.get(a.id))?.photoId).toBeUndefined();
    expect(await db.blobs.get(p2)).toBeDefined();
  });

  it('같은 이름(공백 무시) 분류는 같은 색', async () => {
    await setCategoryColor(db, ' 행 사', '#7A5FD0');
    expect((await categoryColorMap(db)).get('행사')).toBe('#7A5FD0');
  });
});

describe('다크 모드 기본값 (피드백)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('아직 고른 테마가 없으면 폰 설정을 따라 다크·라이트, 고르면 그대로', async () => {
    const { freshDb } = await import('../../test/db');
    const d = freshDb();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark'), media: q, addEventListener() {}, removeEventListener() {} }));
    expect((await activeTheme(d)).id).toBe('dark');
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    expect((await activeTheme(d)).id).toBe('light');
    await applyThemeById(d, 'dark');
    expect((await activeTheme(d)).id).toBe('dark');
  });
});
