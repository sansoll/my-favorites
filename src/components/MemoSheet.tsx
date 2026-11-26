import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import u from './ui.module.css';

export interface MemoSheetProps {
  open: boolean;
  value: string;
  onClose: () => void;
  onSave: (memo: string) => void;
}

/** 메모를 쓰는 시트. 저장을 눌러야 반영되고, 그냥 닫으면 바뀌지 않아요. */
export function MemoSheet({ open, value, onClose, onSave }: MemoSheetProps) {
  const [text, setText] = useState(value);
  useEffect(() => { if (open) setText(value); }, [open, value]);
  return (
    <Sheet open={open} onClose={onClose} title="메모">
      <form className={u.field} onSubmit={(e) => { e.preventDefault(); onSave(text.trim()); }}>
        <textarea
          className={u.input}
          style={{ minHeight: '7.5rem', padding: '0.75rem 0.875rem', resize: 'none', lineHeight: 1.5 }}
          aria-label="메모"
          autoFocus
          maxLength={500}
          placeholder="예: 생일 카페 앞에서 산 굿즈"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <span className={u.hint} style={{ textAlign: 'right' }}>{text.length} / 500</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {value && <button type="button" className={u.ghost} style={{ minHeight: '3.25rem', padding: '0 1.25rem' }} onClick={() => onSave('')}>지우기</button>}
          <button type="submit" className={u.primary} style={{ flex: 1 }}>메모 저장</button>
        </div>
      </form>
    </Sheet>
  );
}
