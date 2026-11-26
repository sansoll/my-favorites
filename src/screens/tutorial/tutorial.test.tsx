import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { listPresets, markBasePresetsAsked } from '../../data/repo/presets';
import { getSetting } from '../../data/settings';
import { STORE_NAMES } from '../../data/db';
import { freshDb } from '../../test/db';
import { STEPS } from './TutorialScreen';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

async function counts() {
  const out: Record<string, number> = {};
  for (const n of STORE_NAMES) out[n] = await db.table(n).count();
  return out;
}

describe('튜토리얼 (U10-4)', () => {
  it('처음 설치하면 튜토리얼 → 13단계(반짝이는 곳을 눌러도 넘어감) → 시작하기 → 기본 프리셋 창, 예시는 저장 안 됨', async () => {
    const router = renderApp();
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'));
    expect(STEPS).toHaveLength(13);
    expect(screen.queryByRole('navigation', { name: '하단 탭' })).not.toBeInTheDocument();
    const before = await counts();

    expect(await screen.findByText('1 / 13')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('region', { name: '예시 화면: 대상 추가' })).getByRole('button', { name: '+ 대상 추가' }));
    expect(screen.getByText('2 / 13')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByText('1 / 13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    for (let k = 1; k < 13; k++) await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('13 / 13')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-confetti]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const dlg = await screen.findByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
    expect(await getSetting(db, 'tutorialDone', false)).toBe(true);
    expect(await counts()).toEqual({ ...before, settings: (await counts()).settings });
    await userEvent.click(within(dlg).getByRole('button', { name: '나중에' }));
    expect(await listPresets(db)).toEqual([]);
  });

  it('건너뛰기도 같고, 다시 열면 튜토리얼이 안 나옴', async () => {
    const router = renderApp();
    await userEvent.click(await screen.findByRole('button', { name: '건너뛰기' }));
    await screen.findByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('이미 프리셋을 물어본 사용자는 튜토리얼 없이 바로 기록 화면', async () => {
    await markBasePresetsAsked(db);
    const router = renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: '기록' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.state.location.pathname).toBe('/');
  });

  it('설정 › 튜토리얼 다시 보기', async () => {
    await markBasePresetsAsked(db);
    const router = renderApp('/settings');
    await userEvent.click(await screen.findByRole('link', { name: /튜토리얼 다시 보기/ }));
    expect(router.state.location.pathname).toBe('/tutorial');
    await userEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
