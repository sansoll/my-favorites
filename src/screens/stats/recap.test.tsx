import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { FirstRun } from '../../app/FirstRun';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addTarget, ensureInitialData, listCategories } from '../../data/repo/lists';
import { markBasePresetsAsked } from '../../data/repo/presets';
import { saveRecord } from '../../data/repo/records';
import { getSetting, setSetting } from '../../data/settings';
import { setCardSharer, type ShareCard } from '../../services/share';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
let shared: ShareCard[];
beforeEach(async () => {
  db = freshDb();
  await ensureInitialData(db);
  await markBasePresetsAsked(db);
  await setSetting(db, 'tutorialDone', true);
  shared = [];
  setCardSharer(async (c) => { shared.push(c); return 'shared'; });
});
afterEach(() => setCardSharer(null));

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

async function seed() {
  const a = await addTarget(db, '가수 A');
  const b = await addTarget(db, '가수 B');
  const ca = (await listCategories(db, a.id))[0];
  const cb = (await listCategories(db, b.id))[0];
  await saveRecord(db, { targetId: a.id, categoryId: ca.id, paid: 120000, date: '2025-05-02' });
  await saveRecord(db, { targetId: b.id, categoryId: cb.id, paid: 50000, date: '2025-09-02' });
}

describe('결산 화면 (U10-3)', () => {
  it('도착 화면 → 열어 보기(처음만 축하) → 카드 넘기기 → 이미지 공유 → 닫기는 통계', async () => {
    await seed();
    const router = renderApp('/stats/recap/2025');
    expect(await screen.findByText(/2025년의/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '열어 보기' }));
    expect(await screen.findByText('2025 연말 결산')).toBeInTheDocument();
    expect(document.querySelector('[data-confetti]')).not.toBeNull();
    expect(await getSetting(db, 'recapOpenedYears', [])).toEqual([2025]);

    const cur = () => screen.getAllByRole('article').find((a) => a.getAttribute('aria-hidden') === 'false')!;
    expect(cur()).toHaveAccessibleName('1 / 4');
    expect(cur()).toHaveTextContent('170,000원');
    expect(cur()).toHaveTextContent('한 달에 평균 14,167원');
    await userEvent.click(screen.getByRole('button', { name: '다음 카드' }));
    expect(cur()).toHaveTextContent('5월');
    expect(cur()).toHaveTextContent('2위 9월 50,000원');
    await userEvent.click(screen.getByRole('button', { name: '다음 카드' }));
    expect(cur()).toHaveTextContent('가수 A');
    await userEvent.click(screen.getByRole('button', { name: '이 카드 이미지로 공유' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]).toMatchObject({ title: '2025 연말 결산', kicker: '가장 많이 쓴 대상은', big: '가수 A' });
    await userEvent.click(screen.getByRole('button', { name: '다음 카드' }));
    expect(screen.getByRole('button', { name: '다음 카드' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(router.state.location.pathname).toBe('/stats');
  });

  it('두 번째로 열면 축하 효과 없음, 데이터 없는 해는 안내', async () => {
    await seed();
    await setSetting(db, 'recapOpenedYears', [2025]);
    renderApp('/stats/recap/2025');
    await userEvent.click(await screen.findByRole('button', { name: '열어 보기' }));
    await screen.findByText('2025 연말 결산');
    expect(document.querySelector('[data-confetti]')).toBeNull();
  });

  it('데이터가 없는 해', async () => {
    renderApp('/stats/recap/2019');
    expect(await screen.findByText('2019년에는 결산할 기록이 없어요')).toBeInTheDocument();
  });

  it('통계 화면에서 결산으로', async () => {
    const router = renderApp('/stats');
    const y = new Date().getFullYear();
    await userEvent.click(await screen.findByRole('link', { name: `${y}년 결산` }));
    expect(router.state.location.pathname).toBe(`/stats/recap/${y}`);
  });
});

describe('새해 첫 실행 (U10-2)', () => {
  function renderFirstRun(thisYear: number) {
    const router = createMemoryRouter([{ path: '*', element: <FirstRun thisYear={thisYear} /> }], { initialEntries: ['/'] });
    render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
    return router;
  }

  it('그해 첫 실행에 지난해 결산을 한 번만 자동으로', async () => {
    await seed();
    const r1 = renderFirstRun(2026);
    await waitFor(() => expect(r1.state.location.pathname).toBe('/stats/recap/2025'));
    expect(await getSetting(db, 'recapAutoYear', null)).toBe(2025);
    await act(async () => { r1.dispose(); });
    document.body.innerHTML = '';
    const r2 = renderFirstRun(2026);
    await new Promise((r) => setTimeout(r, 80));
    expect(r2.state.location.pathname).toBe('/');
  });

  it('지난해 데이터가 없으면 안 띄우고 그해에는 다시 안 봄', async () => {
    const r = renderFirstRun(2026);
    await waitFor(async () => expect(await getSetting(db, 'recapAutoYear', null)).toBe(2025));
    expect(r.state.location.pathname).toBe('/');
    expect(within(document.body).queryByText(/결산/)).toBeNull();
  });
});
