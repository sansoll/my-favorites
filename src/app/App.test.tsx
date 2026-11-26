import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { freshDb } from '../test/db';
import { routes } from './App';

beforeEach(() => { freshDb(); });

function renderAt(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

describe('하단 탭과 화면 이동 (U0-12)', () => {
  it('탭 5개가 순서대로 있음', () => {
    renderAt();
    const nav = screen.getByRole('navigation', { name: '하단 탭' });
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['기록', '내역', '통계', '응원법', '설정']);
  });

  it('탭을 누르면 그 화면으로 이동하고 현재 탭이 표시됨', async () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: '기록' })).toBeInTheDocument();
    for (const name of ['내역', '통계', '응원법', '설정', '기록']) {
      await userEvent.click(screen.getByRole('link', { name }));
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
      expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
  });

  it('뒤로 가기', async () => {
    const router = renderAt();
    await userEvent.click(screen.getByRole('link', { name: '통계' }));
    await userEvent.click(screen.getByRole('link', { name: '설정' }));
    await router.navigate(-1);
    expect(await screen.findByRole('heading', { level: 1, name: '통계' })).toBeInTheDocument();
  });

  it('분류 화면에서도 기록 탭이 현재 탭', async () => {
    renderAt('/record/x');
    expect(await screen.findByRole('link', { name: '기록' })).toHaveAttribute('aria-current', 'page');
  });

  it('없는 주소는 기록 화면', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: '기록' })).toBeInTheDocument();
  });
});
