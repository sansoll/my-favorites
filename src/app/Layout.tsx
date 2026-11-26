import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import s from './Layout.module.css';

export function Layout() {
  return (
    <div className={s.app}>
      <main className={s.main}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
