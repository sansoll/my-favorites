import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDb } from '../data/db';
import { ensureInitialData } from '../data/repo/lists';
import { generateRecurring } from '../data/repo/recurring';
import { getSetting, setSetting } from '../data/settings';
import { notifyDue } from '../services/notify';
import { createBasePresets, listPresets, markBasePresetsAsked, shouldAskBasePresets } from '../data/repo/presets';
import { newYearRecap, recapYears } from '../domain/recap';
import { BasePresetDialog } from '../components/BasePresetDialog';
import { useToast } from '../components/Toast';
import { TUTORIAL_DONE_KEY } from '../screens/tutorial/TutorialScreen';

export const RECAP_AUTO_KEY = 'recapAutoYear';

/**
 * 앱을 열 때:
 * 1) 처음 데이터(`기타`)와 밀린 정기 결제 기록을 만들고 알림을 보냅니다.
 * 2) 처음 설치했으면 튜토리얼을 보여 주고, 끝나거나 건너뛰면 기본 프리셋을 한 번 묻습니다.
 * 3) 새해 첫 실행이면 지난해 결산을 한 번 보여 줍니다(U10-2).
 */
export function FirstRun({ thisYear = new Date().getFullYear() }: { thisYear?: number }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [ask, setAsk] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);
  const recapChecked = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      await ensureInitialData(db);
      // 밀린 정기 결제 기록을 만들고(U3-1), 알림 날이면 폰 알림을 보냅니다(U3-4).
      await generateRecurring(db);
      void notifyDue(db).catch(() => undefined);
      const done = await getSetting(db, TUTORIAL_DONE_KEY, false);
      if (!done) {
        // 이미 프리셋을 물어본 사람(튜토리얼 전 버전 사용자)은 튜토리얼을 건너뜁니다.
        if (!(await shouldAskBasePresets(db))) await setSetting(db, TUTORIAL_DONE_KEY, true);
        else if (alive) navigate('/tutorial', { replace: true });
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []); // 앱을 열 때 한 번만

  useEffect(() => {
    if (!ready || pathname === '/tutorial' || ask) return;
    let alive = true;
    (async () => {
      const db = getDb();
      if (!(await getSetting(db, TUTORIAL_DONE_KEY, false))) return;
      if (await shouldAskBasePresets(db)) {
        const ps = await listPresets(db);
        if (alive) { setExisting(ps.map((p) => p.name)); setAsk(true); }
        return;
      }
      if (recapChecked.current) return;
      recapChecked.current = true;
      const last = await getSetting<number | null>(db, RECAP_AUTO_KEY, null);
      if (last !== null && last >= thisYear - 1) return;
      const [records, checkDays, songOpens] = await Promise.all([db.records.toArray(), db.checkDays.toArray(), db.songOpens.toArray()]);
      const y = newYearRecap(thisYear, last, recapYears(records, checkDays, songOpens));
      await setSetting(db, RECAP_AUTO_KEY, thisYear - 1);
      if (y !== null && alive) navigate(`/stats/recap/${y}`);
    })();
    return () => { alive = false; };
  }, [ready, pathname, ask, navigate, thisYear]);

  const done = async (names: string[]) => {
    const db = getDb();
    await markBasePresetsAsked(db);
    setAsk(false);
    if (names.length) {
      const made = await createBasePresets(db, names);
      if (made.length) toast(`${made.join(', ')} 프리셋을 만들었어요`);
    }
  };

  return <BasePresetDialog open={ask} existing={existing} onLater={() => void done([])} onMake={(n) => void done(n)} />;
}
