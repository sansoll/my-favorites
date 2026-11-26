import { useEffect, useState } from 'react';
import { getDb } from '../data/db';
import { ensureInitialData } from '../data/repo/lists';
import { generateRecurring } from '../data/repo/recurring';
import { notifyDue } from '../services/notify';
import { createBasePresets, listPresets, markBasePresetsAsked, shouldAskBasePresets } from '../data/repo/presets';
import { BasePresetDialog } from '../components/BasePresetDialog';
import { useToast } from '../components/Toast';

/**
 * 앱을 열 때: 처음 데이터(`기타`)를 만들고, 밀린 정기 결제 기록을 만들고, 기본 프리셋을 한 번만 묻습니다.
 * 튜토리얼(M10)을 만들면 튜토리얼이 끝나거나 건너뛴 뒤로 옮깁니다.
 */
export function FirstRun() {
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      await ensureInitialData(db);
      // 밀린 정기 결제 기록을 만들고(U3-1), 알림 날이면 폰 알림을 보냅니다(U3-4).
      await generateRecurring(db);
      void notifyDue(db).catch(() => undefined);
      if (await shouldAskBasePresets(db)) {
        const ps = await listPresets(db);
        if (alive) { setExisting(ps.map((p) => p.name)); setAsk(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

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
