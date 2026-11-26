import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDb } from '../../data/db';
import { listTargets } from '../../data/repo/lists';
import { addSong, listSongs, openCounts } from '../../data/repo/songs';
import { matchTitle } from '../../domain/cheer';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import u from '../../components/ui.module.css';
import s from './Cheer.module.css';

/** 곡 목록(STORYBOARD 7-1, U8-5): 대상별로 모아 보고 제목으로 검색합니다. */
export function CheerScreen() {
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [targets, songs, counts] = await Promise.all([listTargets(db), listSongs(db), openCounts(db)]);
    return { targets, songs, counts };
  }, []);
  if (!data) return null;
  const shown = data.songs.filter((x) => !q.trim() || matchTitle(x.title, q));
  const groups = data.targets.map((t) => ({ t, songs: shown.filter((x) => x.targetId === t.id) })).filter((g) => g.songs.length);

  return (
    <Screen title="응원법" actions={<button type="button" className={s.addBtn} onClick={() => setAdding(true)}>+ 곡 추가</button>}>
      {data.songs.length > 0 && (
        <input className={s.search} type="search" aria-label="곡 제목 검색" placeholder="곡 제목 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {data.songs.length === 0 ? (
        <p className={u.hint}>아직 곡이 없어요. `+ 곡 추가`로 가사를 붙여넣고 떼창과 구호를 표시해 보세요.</p>
      ) : groups.length === 0 ? (
        <p className={u.hint}>찾는 곡이 없어요.</p>
      ) : (
        groups.map(({ t, songs }) => (
          <section key={t.id} className={s.group} aria-label={`${t.name} 곡`}>
            <h2 className={s.groupTitle}><span className={s.dot} style={{ background: t.color }} aria-hidden="true" />{t.name}</h2>
            {songs.map((x) => (
              <Link key={x.id} to={`/cheer/${x.id}`} className={s.songRow}>
                <span className={s.songTitle}>{x.title}</span>
                <span className={s.views}>펼침 {data.counts.get(x.id) ?? 0}번 ›</span>
              </Link>
            ))}
          </section>
        ))
      )}
      <NewSongSheet
        open={adding}
        targets={data.targets}
        onClose={() => setAdding(false)}
        onSave={async (input) => {
          const song = await addSong(getDb(), input);
          setAdding(false);
          toast('곡을 추가했어요. 함께 부를 단어를 눌러 색칠해 보세요');
          navigate(`/cheer/${song.id}?edit=1`);
        }}
      />
    </Screen>
  );
}

function NewSongSheet({ open, targets, onClose, onSave }: {
  open: boolean;
  targets: { id: string; name: string; isEtc: boolean }[];
  onClose: () => void;
  onSave: (input: { targetId: string; title: string; lyrics: string }) => Promise<void>;
}) {
  const real = targets.filter((t) => !t.isEtc);
  const list = real.length ? real : targets;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const picked = targetId ?? list[0]?.id ?? null;
  const ok = !!picked && title.trim() !== '' && lyrics.trim() !== '';
  const close = () => { setTitle(''); setLyrics(''); setTargetId(null); onClose(); };
  return (
    <Sheet open={open} onClose={close} title="곡 추가" kicker="응원법">
      <div className={s.form}>
        <span className={u.label} id="song-target">대상</span>
        <div className={u.chips} role="radiogroup" aria-labelledby="song-target">
          {list.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={picked === t.id} className={`${u.chip} ${picked === t.id ? u.chipOn : ''}`} onClick={() => setTargetId(t.id)}>{t.name}</button>
          ))}
        </div>
        <label className={u.field}>
          <span className={u.label}>제목</span>
          <input className={u.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="곡 제목" maxLength={100} />
        </label>
        <label className={u.field}>
          <span className={u.label}>가사 붙여넣기</span>
          <textarea className={s.textarea} rows={6} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="음원 앱에서 복사한 가사를 붙여넣어요" />
        </label>
        <button type="button" className={u.primary} disabled={!ok} onClick={() => { if (ok) void onSave({ targetId: picked!, title, lyrics }).then(() => { setTitle(''); setLyrics(''); }); }}>저장하고 응원법 표시하기</button>
      </div>
    </Sheet>
  );
}
