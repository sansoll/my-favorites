import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { DatePicker } from './DatePicker';
import { EditableList, LONG_PRESS_MS, type EditableItem } from './EditableList';
import { Keypad, pressKey } from './Keypad';
import { Sheet } from './Sheet';
import { TOAST_MS, ToastProvider, useToast } from './Toast';

describe('시트 (U0-7)', () => {
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>열기</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="새 대상"><input aria-label="이름" /></Sheet>
      </>
    );
  }

  it('열림, 닫기 버튼으로 닫힘', async () => {
    render(<Harness />);
    expect(screen.getByRole('dialog', { name: '새 대상' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('바깥을 누르면 닫힘', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('80px 넘게 끌어내리면 닫히고 덜 끌면 제자리', () => {
    render(<Harness />);
    const d = screen.getByRole('dialog');
    fireEvent.pointerDown(d, { clientY: 100 });
    fireEvent.pointerMove(d, { clientY: 160 });
    fireEvent.pointerUp(d);
    expect(screen.getByRole('dialog')).toHaveStyle({ transform: 'translateY(0px)' });
    fireEvent.pointerDown(d, { clientY: 100 });
    fireEvent.pointerMove(d, { clientY: 190 });
    fireEvent.pointerUp(d);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('입력칸에서는 끌기 안 됨', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: '이름' });
    fireEvent.pointerDown(input, { clientY: 100 });
    fireEvent.pointerMove(input, { clientY: 300 });
    fireEvent.pointerUp(input);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('알림 토스트 (U0-8)', () => {
  function Harness({ onUndo }: { onUndo?: () => void }) {
    const show = useToast();
    return <button onClick={() => show('저장했어요', onUndo ? { action: { label: '되돌리기', onClick: onUndo } } : undefined)}>띄우기</button>;
  }
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('뜨고 약 2초 뒤 사라짐', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('띄우기'));
    expect(screen.getByRole('status')).toHaveTextContent('저장했어요');
    act(() => { vi.advanceTimersByTime(TOAST_MS - 100); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('옆으로 70px 넘게 밀면 바로 사라짐', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('띄우기'));
    const t = screen.getByRole('status');
    fireEvent.pointerDown(t, { clientX: 100 });
    fireEvent.pointerMove(t, { clientX: 150 });
    fireEvent.pointerUp(t);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.pointerDown(t, { clientX: 100 });
    fireEvent.pointerMove(t, { clientX: 180 });
    fireEvent.pointerUp(t);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('되돌리기 버튼을 누르면 동작 호출', () => {
    const undo = vi.fn();
    render(<ToastProvider><Harness onUndo={undo} /></ToastProvider>);
    fireEvent.click(screen.getByText('띄우기'));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(undo).toHaveBeenCalledTimes(1);
  });
});

describe('확인 창 (U0-9)', () => {
  it('제목·내용·버튼 문구, 취소와 확인', async () => {
    const ok = vi.fn();
    const cancel = vi.fn();
    render(<ConfirmDialog open title="가수 A를 삭제할까요?" body="지출 기록 3건이 지워져요." onConfirm={ok} onCancel={cancel} />);
    expect(screen.getByRole('alertdialog', { name: '가수 A를 삭제할까요?' })).toHaveAccessibleDescription('지출 기록 3건이 지워져요.');
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(ok).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('닫혀 있으면 아무것도 안 보임', () => {
    render(<ConfirmDialog open={false} title="x" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('편집 목록 (U0-10)', () => {
  const base: EditableItem[] = [
    { id: 'a', name: '가수 A', amount: 128500 },
    { id: 'd', name: '가수 D', amount: 0 },
    { id: 'e', name: '기타', amount: 50600, isEtc: true },
  ];
  function Harness({ onAction = () => {}, onOpen = () => {} }: { onAction?: (i: EditableItem, a: string) => void; onOpen?: (i: EditableItem) => void }) {
    const [items, setItems] = useState(base);
    const [editing, setEditing] = useState(false);
    return (
      <>
        <button onClick={() => setEditing((x) => !x)}>편집</button>
        <EditableList
          label="대상"
          items={items}
          editing={editing}
          onEditingChange={setEditing}
          onOpen={onOpen}
          onReorder={(ids) => setItems(ids.map((id) => items.find((x) => x.id === id)!))}
          onAction={onAction}
        />
      </>
    );
  }
  const names = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/[≡⋮›]/g, '').replace(/[\d,]+원/, '').trim());

  it('금액 표시와 누르기', async () => {
    const open = vi.fn();
    render(<Harness onOpen={open} />);
    expect(screen.getByText('128,500원')).toBeInTheDocument();
    await userEvent.click(screen.getByText('가수 A'));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('≡를 끌어 순서 바뀜', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '편집' }));
    const h = screen.getByRole('button', { name: '가수 A 순서 바꾸기' });
    fireEvent.pointerDown(h, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(h, { clientY: 115, pointerId: 1 });
    fireEvent.pointerUp(h, { pointerId: 1 });
    expect(names()).toEqual(['가수 D', '기타', '가수 A']);
  });

  it('≡에서 방향키로도 순서 바뀜', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '가수 D 순서 바꾸기' }), { key: 'ArrowUp' });
    expect(names()).toEqual(['가수 D', '가수 A', '기타']);
  });

  it('길게 누르면 편집 모드', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.pointerDown(screen.getByText('가수 A'));
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(screen.getByRole('button', { name: '가수 A 메뉴' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('⋮ 메뉴가 열리고, 기타는 삭제 메뉴가 없음', async () => {
    const act_ = vi.fn();
    render(<Harness onAction={act_} />);
    await userEvent.click(screen.getByRole('button', { name: '편집' }));
    await userEvent.click(screen.getByRole('button', { name: '가수 A 메뉴' }));
    expect(screen.getByRole('button', { name: '가수 A 삭제' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '이름 바꾸기' }));
    expect(act_).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'rename');

    await userEvent.click(screen.getByRole('button', { name: '기타 메뉴' }));
    expect(screen.queryByRole('button', { name: '기타 삭제' })).not.toBeInTheDocument();
    expect(screen.getByText('기타는 항상 있어야 해서 삭제할 수 없어요.')).toBeInTheDocument();
  });
});

describe('숫자 키패드 (U0-11)', () => {
  it('숫자·00·지우기 입력, 앞의 0 무시', () => {
    expect(pressKey(0, '0')).toBe(0);
    expect(pressKey(0, '00')).toBe(0);
    expect(pressKey(0, '1')).toBe(1);
    expect(pressKey(154, '00')).toBe(15400);
    expect(pressKey(15400, 'back')).toBe(1540);
    expect(pressKey(7, 'back')).toBe(0);
    expect(pressKey(0, 'back')).toBe(0);
  });

  it('10자리를 넘기지 않음', () => {
    expect(pressKey(999_999_999, '9')).toBe(9_999_999_999);
    expect(pressKey(9_999_999_999, '1')).toBe(9_999_999_999);
    expect(pressKey(999_999_999, '00')).toBe(999_999_999);
  });

  it('누르면 값이 바뀜', async () => {
    function H() { const [v, setV] = useState(0); return <><output>{v}</output><Keypad value={v} onChange={setV} /></>; }
    render(<H />);
    for (const k of ['1', '5', '4', '00', '0']) await userEvent.click(screen.getByRole('button', { name: k }));
    expect(screen.getByRole('status')).toHaveTextContent('154000');
    await userEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByRole('status')).toHaveTextContent('15400');
  });
});

describe('날짜 달력 (U0-11)', () => {
  it('오늘 표시, 달 넘기기, 날짜 고르기', async () => {
    const sel = vi.fn();
    render(<DatePicker value="2026-11-13" today="2026-11-13" onSelect={sel} />);
    expect(screen.getByRole('button', { name: '11월 13일 오늘' })).toHaveAttribute('aria-current', 'date');
    await userEvent.click(screen.getByRole('button', { name: '지난달' }));
    expect(screen.getByText('2026년 10월')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '10월 31일' }));
    expect(sel).toHaveBeenCalledWith('2026-10-31');
  });

  it('연도를 넘어 달 넘기기', async () => {
    render(<DatePicker value="2026-01-05" today="2026-01-05" onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '지난달' }));
    expect(screen.getByText('2025년 12월')).toBeInTheDocument();
  });

  it('max 뒤로는 고를 수 없고 다음 달로도 못 감', () => {
    render(<DatePicker value="2026-11-13" today="2026-11-13" max="2026-11-13" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '11월 14일' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled();
  });
});
