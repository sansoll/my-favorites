import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import u from './ui.module.css';

export type NameError = 'empty' | 'duplicate' | 'etc' | 'notFound';

const MESSAGES: Record<NameError, string> = {
  empty: '이름을 넣어 주세요.',
  duplicate: '같은 이름이 이미 있어요.',
  etc: '기타는 이름을 바꿀 수 없어요.',
  notFound: '항목을 찾을 수 없어요.',
};

export interface NameSheetProps {
  open: boolean;
  title: string;
  kicker?: string;
  initial?: string;
  submitLabel: string;
  onClose: () => void;
  /** 성공하면 null, 실패하면 이유 */
  onSubmit: (name: string) => Promise<NameError | null>;
  children?: ReactNode;
}

/** 이름 하나를 넣는 시트(새로 만들기, 이름 바꾸기). */
export function NameSheet({ open, title, kicker, initial = '', submitLabel, onClose, onSubmit, children }: NameSheetProps) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<NameError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setName(initial); setError(null); } }, [open, initial]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const e = await onSubmit(name);
    setBusy(false);
    if (e) setError(e);
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} kicker={kicker}>
      <form className={u.field} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className={u.field}>
          <span className={u.label}>이름</span>
          <input
            className={u.input}
            value={name}
            autoFocus
            maxLength={40}
            enterKeyHint="done"
            aria-invalid={!!error}
            onChange={(e) => { setName(e.target.value); setError(null); }}
          />
        </label>
        {error && <p className={u.error} role="alert">{MESSAGES[error]}</p>}
        {children}
        <button type="submit" className={u.primary} disabled={!name.trim() || busy}>{submitLabel}</button>
      </form>
    </Sheet>
  );
}
