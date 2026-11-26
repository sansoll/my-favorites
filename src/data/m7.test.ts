import { BACKUP_VERSION, BackupError, EXPORT_STORES, MAX_IMPORT_BYTES, exportData, exportFileName, exportText, importData, lastExportAt, parseBackup, readBackupFile, validateBackup, wipeAll } from './backup';
import { STORE_NAMES, type FavoritesDB } from './db';
import { addTarget, ensureInitialData, listCategories, listDetails, listTargets } from './repo/lists';
import { createBasePresets, listPresets } from './repo/presets';
import { saveRecord } from './repo/records';
import { addRecurring } from './repo/recurring';
import { addCheckItem, savePhoto, setCover, toggleCheck } from './repo/checks';
import { namePlace } from './repo/places';
import { setSetting } from './settings';
import { freshDb } from '../test/db';
import { safeUrl } from '../domain/url';
import { cspContent, CSP_DIRECTIVES } from '../security/csp';

let db: FavoritesDB;
beforeEach(async () => { db = freshDb(); await ensureInitialData(db); });

async function seed() {
  await createBasePresets(db, ['가수용']);
  const p = (await listPresets(db))[0];
  const a = await addTarget(db, '가수 A', p);
  const ev = (await listCategories(db, a.id)).find((c) => c.name === '행사')!;
  const concert = (await listDetails(db, ev.id)).find((d) => d.name === '콘서트')!;
  const place = await namePlace(db, '올림픽홀');
  await saveRecord(db, { targetId: a.id, categoryId: ev.id, detailId: concert.id, paid: 154000, memo: '첫 콘서트', placeId: place.id, date: '2026-11-13' });
  await addRecurring(db, { targetId: a.id, categoryId: ev.id, detailId: concert.id, amount: 4500, day: 14 }, 'nextMonth', '2026-11-26');
  const item = await addCheckItem(db, a.id, '버블');
  await toggleCheck(db, item.id, '2026-11-20', '2026-11-26');
  const photo = await savePhoto(db, new Blob(['x'], { type: 'image/jpeg' }), 10, 10);
  await setCover(db, item.id, photo, 'all', '2026-11');
  await db.targets.update(a.id, { photoId: photo });
  await db.songs.add({ id: 's1', targetId: a.id, title: '곡 1', lyrics: '가\n나', layer: { marks: [], extras: [] }, links: [], createdAt: 1 });
  await db.themes.add({ id: 'th', name: '흑백', bg: '#000', surface: '#111', accent: '#fff', accent2: '#ccc', text: 'auto' });
  await db.categoryColors.put({ name: '행사', color: '#f00' });
  await setSetting(db, 'theme', 'th');
  return { a, item, photo };
}

async function dump(d: FavoritesDB) {
  const out: Record<string, unknown[]> = {};
  for (const n of EXPORT_STORES) out[n] = (await d.table(n).toArray()).filter((r) => r.key !== 'lastExportAt');
  return out;
}

describe('내보내기 (U7-1)', () => {
  it('버전 번호가 든 JSON 한 파일, 사진·글꼴(blobs)은 빠지고 나머지 저장소는 모두 들어감', async () => {
    await seed();
    const f = await exportData(db, new Date(2026, 10, 26));
    expect(f).toMatchObject({ app: 'my-favorites', version: BACKUP_VERSION });
    expect(Object.keys(f.data).sort()).toEqual(STORE_NAMES.filter((n) => n !== 'blobs').sort());
    expect(f.data.records).toHaveLength(1);
    expect(f.data.songs).toHaveLength(1);
    expect(JSON.stringify(f)).not.toContain('blobs');
    expect(exportFileName(new Date(2026, 0, 5))).toBe('my-favorites-2026-01-05.json');
  });

  it('내보낸 뒤 지우고 불러오면 똑같음, 마지막 내보낸 시각을 남김', async () => {
    await seed();
    const before = await dump(db);
    const text = await exportText(db, new Date(2026, 10, 26, 9));
    expect(await lastExportAt(db)).toBe(new Date(2026, 10, 26, 9).getTime());
    await wipeAll(db);
    await importData(db, parseBackup(text));
    const after = await dump(db);
    // 사진은 지워졌으므로 사진 연결만 빠짐
    const strip = (o: Record<string, unknown[]>) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'photoId' || k === 'cover' ? undefined : v)));
    expect(strip(after)).toEqual(strip(before));
    expect((await db.targets.toArray()).every((t) => !t.photoId)).toBe(true);
    expect((await db.checkItems.toArray())[0].cover).toEqual({ all: null, months: {}, bg: true });
  });

  it('사진이 폰에 남아 있으면 연결도 그대로', async () => {
    const { a, photo } = await seed();
    const text = await exportText(db);
    await importData(db, parseBackup(text));
    expect((await db.targets.get(a.id))?.photoId).toBe(photo);
    expect((await db.checkItems.toArray())[0].cover?.all).toBe(photo);
    expect(await db.blobs.count()).toBe(1);
  });
});

describe('불러오기 검사 (U7-2)', () => {
  const good = async () => JSON.parse(await exportText(db));

  it('크기 상한을 넘으면 거부', async () => {
    await expect(readBackupFile(new Blob(['x'.repeat(MAX_IMPORT_BYTES + 1)]))).rejects.toThrow(/너무 커요/);
  });

  it('JSON이 아니거나 다른 앱 파일, 더 새 버전은 거부', async () => {
    expect(() => parseBackup('{ 깨진')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other","version":1,"data":{}}')).toThrow(/이 앱에서 내보낸 파일이 아니에요/);
    expect(() => parseBackup(JSON.stringify({ app: 'my-favorites', version: BACKUP_VERSION + 1, data: {} }))).toThrow(/새 버전/);
    expect(() => parseBackup(JSON.stringify({ app: 'my-favorites', version: 1, data: [] }))).toThrow(BackupError);
  });

  it('구조가 틀리면 거부: 필드 종류, 빠진 필드, 없는 대상을 가리키는 기록, 같은 번호 두 번', async () => {
    await seed();
    const f = await good();
    const bad1 = structuredClone(f); bad1.data.records[0].paid = '154000';
    const bad2 = structuredClone(f); delete bad2.data.targets[0].name;
    const bad3 = structuredClone(f); bad3.data.records[0].targetId = 'nope';
    const bad4 = structuredClone(f); bad4.data.targets.push(bad4.data.targets[0]);
    const bad5 = structuredClone(f); bad5.data.records[0].date = '2026/11/13';
    const bad6 = structuredClone(f); bad6.data.records = 'x';
    for (const b of [bad1, bad2, bad3, bad4, bad5, bad6]) expect(() => validateBackup(b)).toThrow(BackupError);
  });

  it('거부되면 지금 데이터는 그대로', async () => {
    await seed();
    const before = await dump(db);
    const f = await good();
    f.data.records[0].targetId = 'nope';
    let err: unknown;
    try { await importData(db, validateBackup(f)); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BackupError);
    expect(await dump(db)).toEqual(before);
  });

  it('알 수 없는 필드는 버림', async () => {
    await seed();
    const f = await good();
    f.data.records[0].evil = '<script>';
    expect(validateBackup(f).data.records[0]).not.toHaveProperty('evil');
  });

  it('예전 버전 파일은 변환해서 불러옴', async () => {
    await seed();
    const f = await good();
    // 가상의 v0: 기록 금액을 amount라는 이름으로 두었던 시절
    const old = structuredClone(f);
    old.version = 1;
    for (const r of old.data.records) { r.amount = r.paid; delete r.paid; }
    const migrations = { 1: (d: Record<string, unknown>) => ({ ...d, records: (d.records as Record<string, unknown>[]).map(({ amount, ...r }) => ({ ...r, paid: amount })) }) };
    // 지금 버전이 2인 앱이 v1 파일을 읽는 상황
    const read = validateBackup(old, migrations, 2);
    expect(read.version).toBe(2);
    expect(read.data.records[0].paid).toBe(154000);
    // 변환 방법이 없으면 거부
    expect(() => validateBackup(old, {}, 2)).toThrow(/바꿀 수 없어요/);
    expect(() => validateBackup({ ...old, version: 0 })).toThrow(/버전/);
  });
});

describe('모든 데이터 지우기 (U7-3)', () => {
  it('모든 저장소가 비고 처음 상태(기타만)', async () => {
    await seed();
    await wipeAll(db);
    const ts = await listTargets(db);
    expect(ts.map((t) => t.name)).toEqual(['기타']);
    for (const n of STORE_NAMES) {
      if (n === 'targets' || n === 'categories' || n === 'details') continue;
      expect(await db.table(n).count()).toBe(0);
    }
    expect(await db.categories.count()).toBe(1);
    expect(await db.details.count()).toBe(1);
  });
});

describe('보안 (U7-4)', () => {
  it('링크는 http·https만', () => {
    expect(safeUrl(' https://youtu.be/abc ')).toBe('https://youtu.be/abc');
    expect(safeUrl('http://a.com')).toBe('http://a.com/');
    for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>', 'file:///etc/passwd', 'vbscript:x', 'youtu.be/abc', '']) expect(safeUrl(bad)).toBeNull();
  });

  it('CSP: 자기 자신·카카오·OpenStreetMap만', () => {
    const c = cspContent();
    expect(c).toContain("default-src 'self'");
    expect(c).toContain("object-src 'none'");
    const hosts = Object.values(CSP_DIRECTIVES).flat().filter((v) => v.startsWith('https://'));
    for (const h of hosts) expect(h).toMatch(/kakao\.com$|daumcdn\.net$|openstreetmap\.org$/);
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-inline'");
    expect(CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-eval'");
  });

  it('코드에 HTML로 넣는 방식(dangerouslySetInnerHTML, innerHTML)이 없음', () => {
    const files = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(20);
    for (const [name, src] of Object.entries(files)) {
      expect.soft(/dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), name).toBe(false);
    }
  });
});
