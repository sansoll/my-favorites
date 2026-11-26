import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { formatWon } from '../domain/money';
import { Sheet } from './Sheet';
import s from './EditableList.module.css';

export interface EditableItem {
  id: string;
  name: string;
  /** 이번 달 금액 */
  amount?: number;
  color?: string;
  isEtc?: boolean;
}

export type ItemAction = 'rename' | 'clearData' | 'delete';

export interface EditableListProps {
  items: EditableItem[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onOpen?: (item: EditableItem) => void;
  /** 새 순서의 id 목록 */
  onReorder: (ids: string[]) => void;
  onAction: (item: EditableItem, action: ItemAction) => void;
  /** ⋮ 메뉴 위쪽에 보일 설명(예: 이번 달 금액·기록 건수) */
  menuMeta?: (item: EditableItem) => ReactNode;
  clearDataLabel?: string;
  /** ⋮ 메뉴에 보일 동작. 기본은 모두 */
  actions?: ItemAction[];
  label: string;
}

/** 길게 누르면 편집 모드로 바뀌는 시간 */
export const LONG_PRESS_MS = 500;
const FALLBACK_ROW = 56;

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const out = arr.slice();
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}

/**
 * 편집 모드가 있는 목록. `편집` 또는 길게 누르기로 들어가고,
 * `≡`를 끌어 순서를 바꾸고, `⋮`로 이름 바꾸기·데이터만 삭제·삭제를 고릅니다. `기타`에는 삭제가 없습니다.
 */
export function EditableList({ items, editing, onEditingChange, onOpen, onReorder, onAction, menuMeta, clearDataLabel = '데이터만 삭제', actions = ['rename', 'clearData', 'delete'], label }: EditableListProps) {
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number; rowH: number } | null>(null);
  const [menu, setMenu] = useState<EditableItem | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const cancelPress = () => { if (press.current) clearTimeout(press.current); press.current = null; };

  const startPress = () => {
    longPressed.current = false;
    cancelPress();
    press.current = setTimeout(() => { longPressed.current = true; onEditingChange(true); }, LONG_PRESS_MS);
  };

  const shiftOf = (d: NonNullable<typeof drag>) => Math.round(d.dy / d.rowH);

  const handleDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const h = (e.currentTarget.closest('li') as HTMLElement | null)?.getBoundingClientRect().height || FALLBACK_ROW;
    setDrag({ id, startY: e.clientY, dy: 0, rowH: h });
  };
  const handleMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, dy: e.clientY - drag.startY });
  };
  const handleUp = () => {
    if (!drag) return;
    const from = items.findIndex((x) => x.id === drag.id);
    const to = from + shiftOf(drag);
    setDrag(null);
    if (from >= 0 && to !== from) onReorder(moveItem(items, from, to).map((x) => x.id));
  };
  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const to = e.key === 'ArrowUp' ? idx - 1 : e.key === 'ArrowDown' ? idx + 1 : null;
    if (to === null || to < 0 || to >= items.length) return;
    e.preventDefault();
    onReorder(moveItem(items, idx, to).map((x) => x.id));
  };

  return (
    <>
      <ul className={s.list} aria-label={label}>
        {items.map((it, idx) => {
          const isDragging = drag?.id === it.id;
          const amount = it.amount ?? null;
          return (
            <li key={it.id} className={`${s.row} ${isDragging ? s.dragging : ''}`} style={isDragging ? { transform: `translateY(${drag!.dy}px)` } : undefined}>
              {editing && (
                <button
                  type="button"
                  className={s.handle}
                  aria-label={`${it.name} 순서 바꾸기`}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onPointerDown={(e) => handleDown(e, it.id)}
                  onPointerMove={handleMove}
                  onPointerUp={handleUp}
                  onPointerCancel={handleUp}
                  onKeyDown={(e) => handleKey(e, idx)}
                >≡</button>
              )}
              <button
                type="button"
                className={s.main}
                onPointerDown={editing ? undefined : startPress}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (longPressed.current) { longPressed.current = false; return; }
                  if (editing) setMenu(it);
                  else onOpen?.(it);
                }}
              >
                <span className={s.name}>
                  {it.color && <span className={s.dot} style={{ background: it.color }} aria-hidden="true" />}
                  {it.name}
                </span>
                <span className={s.name}>
                  {amount !== null && <span className={`${s.amount} ${amount === 0 ? s.zero : ''}`}>{formatWon(amount)}</span>}
                  {!editing && <span className={s.chev} aria-hidden="true">›</span>}
                </span>
              </button>
              {editing && (
                <button type="button" className={s.more} aria-label={`${it.name} 메뉴`} onClick={() => setMenu(it)}>⋮</button>
              )}
            </li>
          );
        })}
      </ul>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ''}>
        {menu && (
          <div className={s.menu}>
            {menuMeta && <p className={s.meta}>{menuMeta(menu)}</p>}
            {actions.includes('rename') && !menu.isEtc && (
              <button type="button" className={s.menuItem} onClick={() => { const m = menu; setMenu(null); onAction(m, 'rename'); }}>이름 바꾸기</button>
            )}
            {actions.includes('clearData') && (
              <button type="button" className={s.menuItem} onClick={() => { const m = menu; setMenu(null); onAction(m, 'clearData'); }}>{clearDataLabel}</button>
            )}
            {menu.isEtc ? (
              <p className={s.note}>기타는 항상 있어야 해서 이름을 바꾸거나 삭제할 수 없어요.</p>
            ) : actions.includes('delete') && (
              <button type="button" className={`${s.menuItem} ${s.menuDanger}`} onClick={() => { const m = menu; setMenu(null); onAction(m, 'delete'); }}>{menu.name} 삭제</button>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
