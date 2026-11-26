import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type TouchEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { getSetting, setSetting } from '../../data/settings';
import { computeRecap, type RecapCard, type RecapRow } from '../../domain/recap';
import { formatWon } from '../../domain/money';
import { withEulReul } from '../../domain/name';
import { useLookups } from '../../hooks/useLookups';
import { Confetti } from '../../components/Confetti';
import { useToast } from '../../components/Toast';
import { shareCard } from '../../services/share';
import s from './Recap.module.css';

const OPENED_KEY = 'recapOpenedYears';
const TINTS = ['var(--accent)', '#D9487A', '#1F7A5C', '#2563A8', '#0F766E', '#8E5BD6', '#B45309', 'var(--accent)'];
const SHARE_TINTS = ['#5B4CDB', '#D9487A', '#1F7A5C', '#2563A8', '#0F766E', '#8E5BD6', '#B45309', '#5B4CDB'];

interface CardText { kicker: string; big: string; after: string; lines: string[] }

function rankLine(r: RecapRow, value: string): string {
  return `${r.rank}위  ${r.name}  ${value}`;
}

/** 카드 문구(STORYBOARD 6-3). 1위가 공동이면 `공동 1위`로 알립니다. */
export function cardText(c: RecapCard, year: number): CardText {
  const won = (r: RecapRow) => formatWon(r.value);
  const tie = c.rest[0]?.rank === 1 ? ' (공동 1위)' : '';
  const lines = (f: (r: RecapRow) => string) => c.rest.map((r) => rankLine(r, f(r)));
  switch (c.kind) {
    case 'total':
      return { kicker: `${year}년, 당신은`, big: formatWon(c.top.value), after: '을 좋아하는 것에 썼어요', lines: [`한 달에 평균 ${formatWon(c.average ?? 0)}이에요`] };
    case 'months':
      return { kicker: '돈을 가장 많이 쓴 달은', big: c.top.name, after: `이에요 · ${won(c.top)}${tie}`, lines: lines(won) };
    case 'targets':
      return { kicker: '가장 많이 쓴 대상은', big: c.top.name, after: `에게 ${won(c.top)}${tie}`, lines: lines(won) };
    case 'categories':
      return { kicker: '가장 많이 쓴 분류는', big: c.top.name, after: `에 ${won(c.top)}${tie}`, lines: lines(won) };
    case 'places':
      return { kicker: '가장 많이 간 곳은', big: c.top.name, after: `에 ${c.top.value}번 다녀왔어요${tie}`, lines: lines((r) => `${r.value}번`) };
    case 'checks':
      return { kicker: '가장 많이 체크한 건', big: c.top.name, after: ` ${c.top.value}일${tie}`, lines: lines((r) => `${r.value}일`) };
    case 'cheerMonths':
      return { kicker: '응원법을 가장 많이 펼친 달은', big: c.top.name, after: `에 ${c.top.value}번 펼쳤어요${tie}`, lines: lines((r) => `${r.value}번`) };
    case 'songs':
      return { kicker: '가장 많이 펼친 곡은', big: c.top.name, after: `${withEulReul(c.top.name).slice(c.top.name.length)} ${c.top.value}번 펼쳤어요${tie}`, lines: lines((r) => `${r.value}번`) };
  }
}

/** 연말 결산(STORYBOARD 6-3, U10-3): 도착 화면 → 카드 넘기기 → 이미지 공유. */
export function RecapScreen() {
  const { year: ys = '' } = useParams();
  const year = Number(ys);
  const navigate = useNavigate();
  const toast = useToast();
  const l = useLookups();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [records, places, checkItems, checkDays, songs, songOpens] = await Promise.all([
      db.records.toArray(), db.places.toArray(), db.checkItems.toArray(), db.checkDays.toArray(), db.songs.toArray(), db.songOpens.toArray(),
    ]);
    return { records, places: new Map(places.map((p) => [p.id, p])), checkItems, checkDays, songs, songOpens };
  }, []);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [fire, setFire] = useState(0);
  const touchX = useRef<number | null>(null);

  if (!data || !l || !Number.isInteger(year)) return null;
  const cards = computeRecap({ year, lists: l, ...data });
  const close = () => navigate('/stats');

  const reveal = async () => {
    const db = getDb();
    const seen = await getSetting<number[]>(db, OPENED_KEY, []);
    if (!seen.includes(year)) {
      await setSetting(db, OPENED_KEY, [...seen, year]);
      setFire((f) => f + 1); // 처음 열 때만 축하 효과
    }
    setOpen(true);
  };

  if (!cards.length) {
    return (
      <div className={s.intro}>
        <p className={s.introBig}>{year}년에는 결산할 기록이 없어요</p>
        <Link to="/stats" className={s.ghost}>통계로</Link>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={s.intro}>
        <p className={s.drum}>두구두구…</p>
        <p className={s.introBig}>{year}년의<br />좋아하는 것들 결산이<br />도착했어요</p>
        <button type="button" className={s.openBtn} onClick={() => void reveal()}>열어 보기</button>
        <button type="button" className={s.ghost} onClick={close}>닫기</button>
      </div>
    );
  }

  const go = (k: number) => setI(Math.max(0, Math.min(cards.length - 1, k)));
  const onTouchStart = (e: TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  };
  const cur = cards[i];
  const curText = cardText(cur, year);

  return (
    <div className={s.stage}>
      <Confetti fire={fire} />
      <div className={s.top}>
        <span className={s.title}>{year} 연말 결산</span>
        <button type="button" className={s.close} onClick={close}>닫기</button>
      </div>
      <div className={s.track} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-roledescription="카드 넘기기" aria-label="결산 카드">
        {cards.map((c, k) => {
          const t = cardText(c, year);
          return (
            <article
              key={c.kind}
              className={`${s.card} ${k === i ? s.cardOn : ''}`}
              style={{ transform: `translateX(${(k - i) * 86}%) scale(${k === i ? 1 : 0.86})`, zIndex: cards.length - Math.abs(k - i), background: `linear-gradient(160deg, ${TINTS[k % TINTS.length]}, color-mix(in srgb, ${TINTS[k % TINTS.length]} 55%, black))` }}
              aria-hidden={k !== i}
              aria-label={`${k + 1} / ${cards.length}`}
              onClick={() => k !== i && go(k)}
            >
              <span className={s.num}>{k + 1} / {cards.length}</span>
              <p className={s.kicker}>{t.kicker}</p>
              <p className={s.big}>{t.big}</p>
              <p className={s.after}>{t.after}</p>
              {t.lines.length > 0 && <ul className={s.lines}>{t.lines.map((x) => <li key={x}>{x}</li>)}</ul>}
            </article>
          );
        })}
      </div>
      <div className={s.nav}>
        <button type="button" className={s.navBtn} aria-label="이전 카드" disabled={i === 0} onClick={() => go(i - 1)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span className={s.dots} aria-hidden="true">{cards.map((c, k) => <span key={c.kind} className={k === i ? s.dotOn : s.dot} />)}</span>
        <button type="button" className={s.navBtn} aria-label="다음 카드" disabled={i === cards.length - 1} onClick={() => go(i + 1)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <button
        type="button"
        className={s.share}
        onClick={() => void shareCard({ title: `${year} 연말 결산`, ...curText, color: SHARE_TINTS[i % SHARE_TINTS.length] }, `my-favorites-recap-${year}-${i + 1}.png`)
          .then((r) => { if (r === 'saved') toast('이미지를 저장했어요'); })
          .catch(() => toast('이미지를 만들지 못했어요'))}
      >
        이 카드 이미지로 공유
      </button>
    </div>
  );
}
