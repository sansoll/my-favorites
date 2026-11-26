import { MAX_DIGITS } from '../domain/money';
import s from './Keypad.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const;

/** 키 하나를 눌렀을 때 다음 값. 앞의 0은 무시하고, 10자리를 넘기지 않습니다. */
export function pressKey(value: number, key: (typeof KEYS)[number]): number {
  const cur = value === 0 ? '' : String(value);
  if (key === 'back') return cur.length > 1 ? Number(cur.slice(0, -1)) : 0;
  const next = (cur + key).replace(/^0+/, '');
  if (!next) return 0;
  if (next.length > MAX_DIGITS) return value;
  return Number(next);
}

export function Keypad({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className={s.pad} role="group" aria-label="숫자 키패드">
      {KEYS.map((k) => (
        <button key={k} type="button" className={s.key} aria-label={k === 'back' ? '지우기' : k} onClick={() => onChange(pressKey(value, k))}>
          {k === 'back' ? '⌫' : k}
        </button>
      ))}
    </div>
  );
}
