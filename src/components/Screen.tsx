import type { ReactNode } from 'react';
import s from './Screen.module.css';

export function Screen({ title, actions, children }: { title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.screen}>
      <div className={s.head}>
        <h1 className={s.title}>{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <p className={s.empty}>{children}</p>;
}
