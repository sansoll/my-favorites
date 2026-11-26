import type { FavoritesDB } from '../db';
import { freshDb } from '../../test/db';
import { addTarget, ensureInitialData } from './lists';
import { OPEN_GAP_MS } from '../../domain/cheer';
import { addExtra, addLink, addSong, deleteSong, openCounts, paintWord, recordOpen, removeExtra, removeLink, resetLayer, SongError, updateExtra, updateLyrics } from './songs';

let db: FavoritesDB;
let tid: string;
beforeEach(async () => { db = freshDb(); await ensureInitialData(db); tid = (await addTarget(db, '가수 A')).id; });

const song = () => addSong(db, { targetId: tid, title: ' 곡 1 ', lyrics: '\n첫 줄 가사\n둘째 줄  가사\n' });

describe('곡 저장 (U8-5)', () => {
  it('제목·가사가 비면 거부, 가사는 정리해서 저장', async () => {
    await expect(addSong(db, { targetId: tid, title: ' ', lyrics: 'a' })).rejects.toBeInstanceOf(SongError);
    await expect(addSong(db, { targetId: tid, title: 'a', lyrics: '\n \n' })).rejects.toBeInstanceOf(SongError);
    const s = await song();
    expect(s.title).toBe('곡 1');
    expect(s.lyrics).toBe('첫 줄 가사\n둘째 줄  가사');
  });

  it('링크는 http·https만', async () => {
    const s = await song();
    await expect(addLink(db, s.id, '나쁜', 'javascript:alert(1)')).rejects.toMatchObject({ reason: 'url' });
    await addLink(db, s.id, '', 'https://www.youtube.com/watch?v=1');
    await addLink(db, s.id, '출처', 'http://a.com/x');
    expect((await db.songs.get(s.id))?.links).toEqual([{ name: 'youtube.com', url: 'https://www.youtube.com/watch?v=1' }, { name: '출처', url: 'http://a.com/x' }]);
    await removeLink(db, s.id, 0);
    expect((await db.songs.get(s.id))?.links.map((l) => l.name)).toEqual(['출처']);
  });

  it('곡 삭제는 펼친 기록도 지움', async () => {
    const s = await song();
    await recordOpen(db, s.id, 0);
    await deleteSong(db, s.id);
    expect(await db.songs.count()).toBe(0);
    expect(await db.songOpens.count()).toBe(0);
  });
});

describe('응원법 편집 (U8-4)', () => {
  it('떼창 색칠, 추가 응원 넣기·고치기·지우기, 초기화하면 원본은 남음', async () => {
    const s = await song();
    await paintWord(db, s.id, 0, 1, '#FFE08A');
    const x = await addExtra(db, s.id, { line: 0, word: 1, position: 'after', text: ' 어이! ', color: '#FFD3DE' });
    expect(x.text).toBe('어이!');
    await updateExtra(db, s.id, x.id, '짝짝');
    let got = await db.songs.get(s.id);
    expect(got?.layer.marks).toEqual([{ line: 0, word: 1, color: '#FFE08A' }]);
    expect(got?.layer.extras.map((e) => e.text)).toEqual(['짝짝']);
    await removeExtra(db, s.id, x.id);
    await addExtra(db, s.id, { line: 1, word: 0, position: 'below', text: '하나 둘 셋', color: '#FFD3DE' });
    await resetLayer(db, s.id);
    got = await db.songs.get(s.id);
    expect(got?.layer).toEqual({ marks: [], extras: [] });
    expect(got?.lyrics).toBe('첫 줄 가사\n둘째 줄  가사');
  });

  it('가사 수정: 안 바뀐 줄의 응원법 유지, 바뀐 줄 알림', async () => {
    const s = await song();
    await paintWord(db, s.id, 0, 0, '#FFE08A');
    await paintWord(db, s.id, 1, 0, '#FFE08A');
    const r = await updateLyrics(db, s.id, '첫 줄 가사\n둘째 줄 고친 가사');
    expect(r).toEqual({ changed: [1], dropped: 1 });
    expect((await db.songs.get(s.id))?.layer.marks).toEqual([{ line: 0, word: 0, color: '#FFE08A' }]);
  });
});

describe('펼친 횟수 (U8-7)', () => {
  it('30분 안 다시 열면 안 셈', async () => {
    const s = await song();
    expect(await recordOpen(db, s.id, 1000)).toBe(true);
    expect(await recordOpen(db, s.id, 1000 + OPEN_GAP_MS - 1)).toBe(false);
    expect(await recordOpen(db, s.id, 1000 + OPEN_GAP_MS)).toBe(true);
    expect((await openCounts(db)).get(s.id)).toBe(2);
  });
});
