import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import { listPresets } from '../../data/repo/presets';
import { freshDb } from '../../test/db';
import { setSetting } from '../../data/settings';
import type { FavoritesDB } from '../../data/db';

let db: FavoritesDB;
// 튜토리얼은 tutorial.test.tsx에서 따로 봅니다.
beforeEach(async () => { db = freshDb(); await setSetting(db, 'tutorialDone', true); });

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return { router, ...utils };
}

async function dismissPresetDialog(choice: '나중에' | 'make' = '나중에') {
  const dlg = await screen.findByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
  if (choice === '나중에') await userEvent.click(within(dlg).getByRole('button', { name: '나중에' }));
  else await userEvent.click(within(dlg).getByRole('button', { name: /개 만들기/ }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' })).not.toBeInTheDocument());
}

describe('첫 실행 기본 프리셋 묻기 (U1-7)', () => {
  it('가수용·배우용이 체크돼 있고, 만들기를 누르면 체크한 것만 생김', async () => {
    renderApp();
    const dlg = await screen.findByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
    expect(within(dlg).getByRole('checkbox', { name: /가수용/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dlg).getByRole('checkbox', { name: /배우용/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dlg).getByRole('checkbox', { name: /취미용/ })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(within(dlg).getByRole('checkbox', { name: /배우용/ }));
    await userEvent.click(within(dlg).getByRole('button', { name: '1개 만들기' }));
    await waitFor(async () => expect((await listPresets(db)).map((p) => p.name)).toEqual(['가수용']));
  });

  it('나중에면 아무것도 안 만들고 다시 안 물음', async () => {
    const first = renderApp();
    await dismissPresetDialog('나중에');
    expect(await listPresets(db)).toEqual([]);
    first.unmount();
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '기록' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' })).not.toBeInTheDocument();
  });
});

describe('기록 화면 흐름 (U1-5, U1-6)', () => {
  it('대상 추가(프리셋) → 분류 → 세부 → 금액 → 저장하면 첫 화면으로 돌아가 알림과 금액 반영', async () => {
    const { router } = renderApp();
    await dismissPresetDialog('make');
    expect(await screen.findByRole('button', { name: /기타/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ 대상 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '새 대상' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '가수 A');
    await userEvent.click(within(sheet).getByRole('radio', { name: '가수용' }));
    expect(within(sheet).getByText(/행사, 경비, 상품, 멤버십, 서포트와 각 세부/)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));

    const list = await screen.findByRole('list', { name: '대상' });
    await waitFor(() => expect(within(list).getAllByRole('listitem').map((li) => li.textContent?.split('0원')[0])).toEqual(['가수 A', '기타']));

    await userEvent.click(within(list).getByRole('button', { name: /가수 A/ }));
    expect(await screen.findByRole('heading', { name: '어디에 썼나요?' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /행사/ }));
    expect(await screen.findByRole('heading', { name: '자세히 고를까요?' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /^콘서트/ }));

    const save = await screen.findByRole('button', { name: '저장' });
    expect(save).toBeDisabled();
    expect(screen.queryByRole('navigation', { name: '하단 탭' })).not.toBeInTheDocument();
    for (const k of ['1', '5', '4', '0', '00']) await userEvent.click(screen.getByRole('button', { name: k }));
    expect(screen.getByText('154,000')).toBeInTheDocument();
    await userEvent.click(save);

    expect(await screen.findByRole('status')).toHaveTextContent('가수 A › 행사 › 콘서트 154,000원을 저장했어요');
    expect(router.state.location.pathname).toBe('/');
    const list2 = await screen.findByRole('list', { name: '대상' });
    await waitFor(() => expect(within(list2).getByRole('button', { name: /가수 A/ })).toHaveTextContent('154,000원'));
    expect(screen.getByRole('link', { name: /이번 달 지출/ })).toHaveTextContent('154,000원');
    const recent = await screen.findByRole('list', { name: '최근 기록' });
    expect(recent).toHaveTextContent('행사 › 콘서트');
    expect(await db.records.count()).toBe(1);
  });

  it('세부 건너뛰기 → 기타로 저장, 기타 내용', async () => {
    renderApp();
    await dismissPresetDialog('make');
    await userEvent.click(screen.getByRole('button', { name: '+ 대상 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '새 대상' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '배우 E');
    await userEvent.click(within(sheet).getByRole('radio', { name: '배우용' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    await userEvent.click(await screen.findByRole('button', { name: /배우 E/ }));
    await userEvent.click(await screen.findByRole('button', { name: /경비/ }));
    await userEvent.click(await screen.findByRole('button', { name: '건너뛰기 · 기타로 저장' }));
    await userEvent.type(await screen.findByPlaceholderText(/선택/), '택시');
    for (const k of ['8', '0', '00']) await userEvent.click(screen.getByRole('button', { name: k }));
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('status')).toHaveTextContent('배우 E › 경비 › 택시 8,000원을 저장했어요');
    const rec = (await db.records.toArray())[0];
    expect(rec.etcText).toBe('택시');
    expect((await db.details.get(rec.detailId))!.isEtc).toBe(true);
  });

  it('편집 모드에서 이름 바꾸기, 같은 이름이면 막힘', async () => {
    renderApp();
    await dismissPresetDialog();
    await userEvent.click(screen.getByRole('button', { name: '+ 대상 추가' }));
    let sheet = await screen.findByRole('dialog', { name: '새 대상' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '가수 A');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    await screen.findByRole('button', { name: /가수 A/ });

    await userEvent.click(screen.getByRole('button', { name: '편집' }));
    await userEvent.click(screen.getByRole('button', { name: '가수 A 메뉴' }));
    await userEvent.click(await screen.findByRole('button', { name: '이름 바꾸기' }));
    sheet = await screen.findByRole('dialog', { name: '이름 바꾸기' });
    const input = within(sheet).getByRole('textbox', { name: '이름' });
    await userEvent.clear(input);
    await userEvent.type(input, '기 타');
    await userEvent.click(within(sheet).getByRole('button', { name: '변경' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('같은 이름이 이미 있어요.');
    await userEvent.clear(input);
    await userEvent.type(input, '가수 B');
    await userEvent.click(within(sheet).getByRole('button', { name: '변경' }));
    expect(await screen.findByRole('button', { name: '가수 B 메뉴' })).toBeInTheDocument();
    expect((await db.targets.toArray()).map((t) => t.name).sort()).toEqual(['가수 B', '기타']);
  });

  it('대상 화면에서 새 분류 추가', async () => {
    renderApp();
    await dismissPresetDialog();
    const etc = (await db.targets.toArray())[0];
    renderApp(`/record/${etc.id}`);
    const addBtns = await screen.findAllByRole('button', { name: '+ 분류 추가' });
    await userEvent.click(addBtns[addBtns.length - 1]);
    const sheet = await screen.findByRole('dialog', { name: '새 분류' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '체험');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    await waitFor(async () => expect((await db.categories.where('targetId').equals(etc.id).toArray()).map((c) => c.name).sort()).toEqual(['기타', '체험']));
  });
});
