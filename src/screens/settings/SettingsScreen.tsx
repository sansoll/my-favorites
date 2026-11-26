import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { getDb } from '../../data/db';
import { listPresets } from '../../data/repo/presets';
import { listRecurrings } from '../../data/repo/recurring';
import { Placeholder, Screen } from '../../components/Screen';
import s from './Settings.module.css';

/** 설정. 테마, 백업 등은 각 단계(M3, M7, M9)에서 더합니다. */
export function SettingsScreen() {
  const presets = useLiveQuery(() => listPresets(getDb()), []) ?? [];
  const recurrings = useLiveQuery(() => listRecurrings(getDb()), []) ?? [];
  return (
    <Screen title="설정">
      <section className={s.group}>
        <h2 className={s.groupTitle}>목록과 꾸미기</h2>
        <Link to="/settings/presets" className={s.row}><span>프리셋</span><span className={s.meta}>{presets.length ? presets.map((p) => p.name).join(' · ') : '없음'} ›</span></Link>
        <Link to="/settings/recurring" className={s.row}><span>정기 결제</span><span className={s.meta}>{recurrings.length ? `${recurrings.filter((x) => x.enabled).length}개 켜짐` : '없음'} ›</span></Link>
      </section>
      <Placeholder>테마, 내보내기·불러오기는 다음 단계에서 여기에 생겨요.</Placeholder>
    </Screen>
  );
}
