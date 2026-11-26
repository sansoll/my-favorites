import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addTarget, listCategories, listDetails } from '../../data/repo/lists';
import { namePlace } from '../../data/repo/places';
import { createBasePresets, listPresets, markBasePresetsAsked } from '../../data/repo/presets';
import { saveRecord } from '../../data/repo/records';
import { today } from '../../domain/date';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
beforeEach(async () => { db = freshDb(); await markBasePresetsAsked(db); });

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

async function seed() {
  await createBasePresets(db, ['가수용']);
  const p = (await listPresets(db))[0];
  const a = await addTarget(db, '가수 A', p);
  const b = await addTarget(db, '가수 B', p);
  const ev = (await listCategories(db, a.id)).find((c) => c.name === '행사')!;
  const concert = (await listDetails(db, ev.id)).find((d) => d.name === '콘서트')!;
  const evB = (await listCategories(db, b.id)).find((c) => c.name === '행사')!;
  const place = await namePlace(db, '올림픽홀');
  await saveRecord(db, { targetId: a.id, categoryId: ev.id, detailId: concert.id, paid: 124000, placeId: place.id });
  await saveRecord(db, { targetId: b.id, categoryId: evB.id, paid: 22000, placeId: place.id });
  return { a, b };
}

describe('통계 화면 (U6-2)', () => {
  it('이번 달 총액, 1위, 랭킹, 이전 달로 가면 빈 상태, 다음은 이번 달에서 멈춤', async () => {
    await seed();
    renderApp('/stats');
    expect((await screen.findAllByText('146,000원')).length).toBeGreaterThan(0);
    expect(screen.getByText('1위 대상').nextSibling).toHaveTextContent('가수 A');
    expect(within(screen.getByRole('region', { name: '분류 랭킹' })).getByText('146,000원')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 기간' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '이전 기간' }));
    expect(screen.getByText('이 기간에는 기록이 없어요.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '연' }));
    expect(screen.getByText(`${today().slice(0, 4)}년`)).toBeInTheDocument();
    expect(screen.getAllByText('146,000원').length).toBeGreaterThan(0);
  });
});

describe('다녀온 곳 화면 (U6-4)', () => {
  it('펼치면 날짜별 기록, 누르면 기록 상세, 이름 바꾸기', async () => {
    await seed();
    const router = renderApp('/stats');
    await userEvent.click(await screen.findByRole('link', { name: /다녀온 곳/ }));
    expect(await screen.findByText('1곳 · 1번')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /올림픽홀/ }));
    const recs = screen.getByRole('list', { name: '올림픽홀 기록' });
    expect(within(recs).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '장소 연결하기' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '이름 바꾸기' }));
    const sheet = await screen.findByRole('dialog', { name: '보이는 이름 바꾸기' });
    const input = within(sheet).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '올림픽 홀');
    await userEvent.click(within(sheet).getByRole('button', { name: '바꾸기' }));
    expect(await screen.findByRole('button', { name: /올림픽 홀/ })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('list', { name: '올림픽 홀 기록' })).getAllByRole('link')[0]);
    expect(router.state.location.pathname).toMatch(/^\/records\//);
  });
});
