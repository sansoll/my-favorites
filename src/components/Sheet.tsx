import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import s from './Sheet.module.css';

/** 이만큼 넘게 끌어내리면 닫힙니다. */
export const SHEET_CLOSE_DRAG = 80;

const NO_DRAG = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children?: ReactNode;
}

/** 아래에서 올라오는 창. 닫기 버튼, 바깥 누르기, 아래로 끌어내리기로 닫습니다. */
export function Sheet({ open, onClose, title, kicker, children }: SheetProps) {
  const titleId = useId();
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDy(0);
    start.current = null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const down = (e: PointerEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (NO_DRAG.has(tag) || (e.target as HTMLElement).isContentEditable) return;
    start.current = e.clientY;
    setDy(0);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setDy(Math.max(0, e.clientY - start.current));
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (dy > SHEET_CLOSE_DRAG) onClose();
    else setDy(0);
  };

  return createPortal(
    <div className={s.backdrop} data-testid="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={s.panel}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: `translateY(${dy}px)`, transition: start.current === null ? 'transform 220ms ease' : 'none' }}
      >
        <span className={s.grip} aria-hidden="true"><span /></span>
        <div className={s.head}>
          <div>
            {kicker && <span className={s.kicker}>{kicker}</span>}
            <h2 id={titleId} className={s.title}>{title}</h2>
          </div>
          <button type="button" className={s.close} onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
