import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import s from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 지우는 동작이면 빨간 버튼 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 지워지거나 옮겨지는 범위와 건수를 보여 주고 확인을 받습니다. */
export function ConfirmDialog({ open, title, body, confirmLabel = '삭제', cancelLabel = '취소', danger = true, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className={s.backdrop}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined} className={s.box}>
        <h2 id={titleId} className={s.title}>{title}</h2>
        {body && <p id={bodyId} className={s.body}>{body}</p>}
        <div className={s.row}>
          <button ref={cancelRef} type="button" className={`${s.btn} ${s.cancel}`} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`${s.btn} ${danger ? s.danger : s.ok}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
