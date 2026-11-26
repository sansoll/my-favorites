import { KeyboardDismiss } from './KeyboardDismiss';
import { Outlet, useMatches } from 'react-router-dom';
import { FirstRun } from './FirstRun';
import { ThemeApplier } from './ThemeApplier';
import { TabBar } from './TabBar';
import s from './Layout.module.css';

export function Layout() {
  const hideTabs = useMatches().some((m) => (m.handle as { hideTabs?: boolean } | undefined)?.hideTabs);
  return (
    <div className={s.app}>
      {__PREVIEW__ && <div className={s.preview} role="note">미리보기 · 본 앱과 데이터가 따로예요</div>}
      <main className={s.main}>
        <Outlet />
      </main>
      {!hideTabs && <TabBar />}
      <FirstRun />
      <ThemeApplier />
      <KeyboardDismiss />
    </div>
  );
}
