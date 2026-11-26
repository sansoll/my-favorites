import { Outlet, useMatches } from 'react-router-dom';
import { FirstRun } from './FirstRun';
import { TabBar } from './TabBar';
import s from './Layout.module.css';

export function Layout() {
  const hideTabs = useMatches().some((m) => (m.handle as { hideTabs?: boolean } | undefined)?.hideTabs);
  return (
    <div className={s.app}>
      <main className={s.main}>
        <Outlet />
      </main>
      {!hideTabs && <TabBar />}
      <FirstRun />
    </div>
  );
}
