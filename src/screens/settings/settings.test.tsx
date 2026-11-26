import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { exportText } from '../../data/backup';
import { addTarget, ensureInitialData, listCategories, listTargets } from '../../data/repo/lists';
import { markBasePresetsAsked } from '../../data/repo/presets';
import { saveRecord } from '../../data/repo/records';
import { setFileSaver } from '../../services/file';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
let saved: { name: string; text: string }[];
beforeEach(async () => {
  db = freshDb();
  await ensureInitialData(db);
  await markBasePresetsAsked(db);
  saved = [];
  setFileSaver((name, text) => { saved.push({ name, text }); });
});
afterEach(() => setFileSaver(null));

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

async function seedOne(name = '가수 A', memo = '') {
  const a = await addTarget(db, name);
  const c = (await listCategories(db, a.id))[0];
  await saveRecord(db, { targetId: a.id, categoryId: c.id, paid: 5000, memo });
  return a;
}

describe('설정 화면 (U7-5)', () => {
  it('각 메뉴 이동: 프리셋, 정기 결제', async () => {
    const router = renderApp('/settings');
    await userEvent.click(await screen.findByRole('link', { name: /프리셋/ }));
    expect(router.state.location.pathname).toBe('/settings/presets');
    router.navigate('/settings');
    await userEvent.click(await screen.findByRole('link', { name: /정기 결제/ }));
    expect(router.state.location.pathname).toBe('/settings/recurring');
  });

  it('내보내기 창 → 파일로 저장 → 마지막 내보낸 시각 표시', async () => {
    await seedOne();
    renderApp('/settings');
    expect(await screen.findByRole('button', { name: /내보내기.*아직 안 함/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /내보내기/ }));
    const dlg = screen.getByRole('dialog', { name: '내보내기' });
    expect(dlg).toHaveTextContent('사진(대상 사진·달력 표지)과 글꼴 파일은 넣지 않아요');
    await userEvent.click(within(dlg).getByRole('button', { name: '파일로 저장' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].name).toMatch(/^my-favorites-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(saved[0].text).data.records).toHaveLength(1);
    expect(await screen.findByRole('button', { name: /내보내기.*마지막/ })).toBeInTheDocument();
  });

  it('불러오기: 파일 고르기 → 덮어쓰기 확인 → 바뀜, 취소하면 그대로', async () => {
    await seedOne('가수 B');
    const text = await exportText(db);
    await seedOne('가수 C');
    renderApp('/settings');
    const input = await screen.findByLabelText('불러올 파일');

    await userEvent.upload(input, new File([text], 'b.json', { type: 'application/json' }));
    let dlg = await screen.findByRole('alertdialog', { name: '지금 데이터를 덮어쓸까요?' });
    expect(dlg).toHaveTextContent('기록 1건');
    await userEvent.click(within(dlg).getByRole('button', { name: '취소' }));
    expect((await listTargets(db)).map((t) => t.name)).toContain('가수 C');

    await userEvent.upload(input, new File([text], 'b.json', { type: 'application/json' }));
    dlg = await screen.findByRole('alertdialog', { name: '지금 데이터를 덮어쓸까요?' });
    await userEvent.click(within(dlg).getByRole('button', { name: '덮어쓰기' }));
    expect(await screen.findByText('불러왔어요. 기록 1건')).toBeInTheDocument();
    expect((await listTargets(db)).map((t) => t.name)).not.toContain('가수 C');
  });

  it('불러오기: 잘못된 파일이면 알리고 데이터는 그대로', async () => {
    await seedOne();
    renderApp('/settings');
    await userEvent.upload(await screen.findByLabelText('불러올 파일'), new File(['{"app":"x"}'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 앱에서 내보낸 파일이 아니에요');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.records.count()).toBe(1);
  });

  it('모든 데이터 지우기: 확인 문구 → 지우면 기타만 남고 첫 화면으로', async () => {
    await seedOne();
    const router = renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: /모든 데이터 지우기/ }));
    const dlg = screen.getByRole('alertdialog', { name: '모든 데이터를 지울까요?' });
    expect(dlg).toHaveTextContent('내보낸 파일이 없으면 되돌릴 수 없어요');
    await userEvent.click(within(dlg).getByRole('button', { name: '모두 지우기' }));
    expect(await screen.findByText('모든 데이터를 지웠어요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect((await listTargets(db)).map((t) => t.name)).toEqual(['기타']);
    expect(await db.records.count()).toBe(0);
  });

  it('앱 정보 창: 버전과 밖으로 나가는 데이터 안내', async () => {
    renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: /앱 정보/ }));
    const dlg = screen.getByRole('dialog', { name: '앱 정보' });
    expect(dlg).toHaveTextContent(__APP_VERSION__);
    expect(dlg).toHaveTextContent('검색어');
    expect(screen.getByText('구글 계정 연동').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('보안: 글은 글자로만 (U7-4)', () => {
  it('이름·메모에 HTML을 넣어도 글자로 보이고 실행되지 않음', async () => {
    const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    await seedOne(evil, evil);
    renderApp('/history');
    expect((await screen.findAllByText(evil, { exact: false })).length).toBeGreaterThan(0);
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.querySelector('main script, #root script')).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });
});
