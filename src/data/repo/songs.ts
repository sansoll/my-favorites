import { newId, type FavoritesDB } from '../db';
import type { Song, SongExtra } from '../types';
import { cleanLyrics, EMPTY_LAYER, relayout, shouldCountOpen, toggleMark, type Layer } from '../../domain/cheer';
import { safeUrl } from '../../domain/url';

export class SongError extends Error {
  constructor(public reason: 'title' | 'lyrics' | 'url' | 'missing') { super(reason); }
}

export interface SongInput { targetId: string; title: string; lyrics: string }

export async function addSong(db: FavoritesDB, input: SongInput, now = Date.now()): Promise<Song> {
  const title = input.title.trim();
  const lyrics = cleanLyrics(input.lyrics);
  if (!title) throw new SongError('title');
  if (!lyrics.trim()) throw new SongError('lyrics');
  const song: Song = { id: newId(), targetId: input.targetId, title, lyrics, layer: { marks: [], extras: [] }, links: [], createdAt: now };
  await db.songs.add(song);
  return song;
}

export async function listSongs(db: FavoritesDB): Promise<Song[]> {
  return (await db.songs.toArray()).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

async function mustGet(db: FavoritesDB, id: string): Promise<Song> {
  const s = await db.songs.get(id);
  if (!s) throw new SongError('missing');
  return s;
}

export async function renameSong(db: FavoritesDB, id: string, title: string): Promise<void> {
  const t = title.trim();
  if (!t) throw new SongError('title');
  await db.songs.update(id, { title: t });
}

export async function setLayer(db: FavoritesDB, id: string, layer: Layer): Promise<void> {
  await db.songs.update(id, { layer });
}

export async function paintWord(db: FavoritesDB, id: string, line: number, word: number, color: string | null): Promise<void> {
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { layer: toggleMark(s.layer, line, word, color) });
  });
}

export type ExtraInput = Omit<SongExtra, 'id'>;

export async function addExtra(db: FavoritesDB, id: string, input: ExtraInput): Promise<SongExtra> {
  const text = input.text.trim();
  if (!text) throw new SongError('lyrics');
  const x: SongExtra = { ...input, text, id: newId() };
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { layer: { ...s.layer, extras: [...s.layer.extras, x] } });
  });
  return x;
}

export async function updateExtra(db: FavoritesDB, id: string, extraId: string, text: string): Promise<void> {
  const t = text.trim();
  if (!t) throw new SongError('lyrics');
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { layer: { ...s.layer, extras: s.layer.extras.map((x) => (x.id === extraId ? { ...x, text: t } : x)) } });
  });
}

export async function removeExtra(db: FavoritesDB, id: string, extraId: string): Promise<void> {
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { layer: { ...s.layer, extras: s.layer.extras.filter((x) => x.id !== extraId) } });
  });
}

/** 응원법 초기화: 떼창과 추가 응원을 모두 지우고 원본 가사는 남깁니다. */
export async function resetLayer(db: FavoritesDB, id: string): Promise<void> {
  await db.songs.update(id, { layer: { ...EMPTY_LAYER } });
}

/** 가사 수정(U8-3): 바뀌지 않은 줄의 응원법은 유지하고 바뀐 줄을 돌려줍니다. */
export async function updateLyrics(db: FavoritesDB, id: string, raw: string): Promise<{ changed: number[]; dropped: number }> {
  const lyrics = cleanLyrics(raw);
  if (!lyrics.trim()) throw new SongError('lyrics');
  return db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    const r = relayout(s.lyrics, lyrics, s.layer);
    await db.songs.update(id, { lyrics, layer: r.layer });
    return { changed: r.changed, dropped: r.dropped };
  });
}

export async function deleteSong(db: FavoritesDB, id: string): Promise<void> {
  await db.transaction('rw', db.songs, db.songOpens, async () => {
    await db.songOpens.where('songId').equals(id).delete();
    await db.songs.delete(id);
  });
}

/** 링크는 http·https만 저장합니다. 이름이 비면 주소의 도메인을 씁니다. */
export async function addLink(db: FavoritesDB, id: string, name: string, url: string): Promise<void> {
  const safe = safeUrl(url);
  if (!safe) throw new SongError('url');
  const label = name.trim() || new URL(safe).hostname.replace(/^www\./, '');
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { links: [...s.links, { name: label, url: safe }] });
  });
}

export async function removeLink(db: FavoritesDB, id: string, index: number): Promise<void> {
  await db.transaction('rw', db.songs, async () => {
    const s = await mustGet(db, id);
    await db.songs.update(id, { links: s.links.filter((_, i) => i !== index) });
  });
}

/** 곡을 열면 펼친 횟수를 셉니다. 같은 곡을 30분 안에 다시 열면 세지 않습니다(U8-7). */
export async function recordOpen(db: FavoritesDB, songId: string, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.songOpens, async () => {
    const opens = await db.songOpens.where('songId').equals(songId).toArray();
    const last = opens.reduce<number | null>((m, o) => (m === null || o.at > m ? o.at : m), null);
    if (!shouldCountOpen(last, now)) return false;
    await db.songOpens.add({ id: newId(), songId, at: now });
    return true;
  });
}

export async function openCounts(db: FavoritesDB): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await db.songOpens.each((o) => { out.set(o.songId, (out.get(o.songId) ?? 0) + 1); });
  return out;
}
