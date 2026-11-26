import { NavLink } from 'react-router-dom';
import s from './TabBar.module.css';

const icon = (d: React.ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{d}</svg>
);

export const TABS = [
  { to: '/', label: '기록', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>) },
  { to: '/history', label: '내역', icon: icon(<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />) },
  { to: '/stats', label: '통계', icon: icon(<path d="M5 20V11M12 20V4M19 20v-6" />) },
  { to: '/cheer', label: '응원법', icon: icon(<><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>) },
  { to: '/settings', label: '설정', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>) },
] as const;

export function TabBar() {
  return (
    <nav aria-label="하단 탭" className={s.bar}>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `${s.tab} ${isActive ? s.active : ''}`}>
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
