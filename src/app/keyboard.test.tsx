import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardDismiss, shouldDismiss } from './KeyboardDismiss';

describe('키보드 내리기 (휴대폰 피드백)', () => {
  it('입력칸 말고 다른 곳을 누르면 입력이 끝나고, 입력칸·라벨을 누르면 그대로', async () => {
    render(
      <div>
        <KeyboardDismiss />
        <input aria-label="검색" />
        <label>메모<textarea /></label>
        <p>빈 곳</p>
        <button type="button">버튼</button>
      </div>,
    );
    const input = screen.getByRole('textbox', { name: '검색' });
    await userEvent.click(input);
    expect(input).toHaveFocus();
    await userEvent.click(screen.getByText('빈 곳'));
    expect(input).not.toHaveFocus();
    await userEvent.click(input);
    await userEvent.click(screen.getByRole('button', { name: '버튼' }));
    expect(input).not.toHaveFocus();
    await userEvent.click(input);
    await userEvent.click(input);
    expect(input).toHaveFocus();
  });

  it('입력 중이 아니면 아무것도 안 함, 체크박스는 글자 입력칸이 아님', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    expect(shouldDismiss(document.body, cb)).toBe(false);
    expect(shouldDismiss(document.body, document.body)).toBe(false);
    const t = document.createElement('textarea');
    expect(shouldDismiss(document.body, t)).toBe(true);
    expect(shouldDismiss(t, t)).toBe(false);
  });
});
