import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import s from './Toast.module.css';

/** 알림이 떠 있는 시간 */
export const TOAST_MS = 2000;
/** 옆으로 이만큼 넘게 밀면 바로 닫힙니다. */
export const TOAST_SWIPE = 70;

export interface ToastOptions {
  action?: { label: string; onClick: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const Ctx = createContext<(message: string, opts?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const show = useCallback((message: string, opts?: ToastOptions) => {
    seq.current += 1;
    setToast({ id: seq.current, message, ...opts });
  }, []);
  const hide = useCallback(() => setToast(null), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onDone={hide} />}
    </Ctx.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  const down = (e: PointerEvent) => { start.current = e.clientX; setDx(0); };
  const move = (e: PointerEvent) => { if (start.current !== null) setDx(e.clientX - start.current); };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (Math.abs(dx) > TOAST_SWIPE) onDone();
    else setDx(0);
  };

  return (
    <div
      role="status"
      className={s.toast}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ transform: `translateX(${dx}px)`, opacity: Math.max(0, 1 - Math.abs(dx) / 220) }}
    >
      <span className={s.msg}>{toast.message}</span>
      {toast.action && (
        <button type="button" className={s.action} onPointerDown={(e) => e.stopPropagation()} onClick={() => { toast.action!.onClick(); onDone(); }}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
