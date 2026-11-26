import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import { markBasePresetsAsked, createBasePresets, listPresets } from '../../data/repo/presets';
import { addTarget, listCategories, listDetails } from '../../data/repo/lists';
import { saveRecord } from '../../data/repo/records';
import { today } from '../../domain/date';
import { freshDb } from '../../test/db';
import type { FavoritesDB } from '../../data/db';

let db: FavoritesDB;

async function seed() {
  await markBasePresetsAsked(db);
  await createBasePresets(db, ['가수용']);
  const p = (await listPresets(db))[0];
  const a = await addTarget(db, '가수 A', p);
  const b = await addTarget(db, '가수 B', p);
  const ev = (await listCategories(db, a.id))[0];
  const concert = (await listDetails(db, ev.id))[0];
  const evB = (await listCategories(db, b.id))[0];
  const r1 = await saveRecord(db, { targetId: a.id, categoryId: ev.id, detailId: concert.id, paid: 154000, date: today() });
  const r2 = await saveRecord(db, { targetId: b.id, categoryId: evB.id, paid: 22000, date: today() });
  return { a, b, ev, concert, r1, r2, p };
}

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

beforeEach(() => { db = freshDb(); });

describe('기록 상세 (U2-3)', () => {
  it('처음엔 보기 전용, 수정을 눌러야 고칠 수 있고 삭제는 수정 중에만', async () => {
    const { r1 } = await seed();
    renderApp(`/records/${r1.id}`);
    expect(await screen.findByRole('heading', { name: '기록 상세' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(screen.getByRole('heading', { name: '기록 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('환불을 넣고 저장하면 집계가 바뀌고 보기로 돌아감, 환불이 크면 저장 꺼짐', async () => {
    const { r1 } = await seed();
    renderApp(`/records/${r1.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '수정' }));
    const refund = screen.getByRole('textbox', { name: '환불 금액' });
    await userEvent.clear(refund);
    await userEvent.type(refund, '200000');
    expect(screen.getByRole('alert')).toHaveTextContent('환불 금액은 결제 금액보다 클 수 없어요.');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await userEvent.clear(refund);
    await userEvent.type(refund, '30000');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('heading', { name: '기록 상세' })).toBeInTheDocument();
    expect(screen.getByText('124,000원')).toBeInTheDocument();
    expect((await db.records.get(r1.id))!.refund).toBe(30000);
  });

  it('취소하면 원래대로', async () => {
    const { r1 } = await seed();
    renderApp(`/records/${r1.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '수정' }));
    const paid = screen.getByRole('textbox', { name: '결제 금액' });
    await userEvent.clear(paid);
    await userEvent.type(paid, '1');
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(await screen.findByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getAllByText('154,000원').length).toBeGreaterThan(0);
    expect((await db.records.get(r1.id))!.paid).toBe(154000);
  });

  it('삭제하면 내역으로 가고 되돌리기로 복구', async () => {
    const { r1 } = await seed();
    const router = renderApp(`/records/${r1.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '수정' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dlg = screen.getByRole('alertdialog', { name: '이 기록을 삭제할까요?' });
    await userEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'));
    expect(await db.records.get(r1.id)).toBeUndefined();
    await userEvent.click(await screen.findByRole('button', { name: '되돌리기' }));
    await waitFor(async () => expect(await db.records.get(r1.id)).toBeDefined());
  });
});

describe('내역 화면 (U2-7)', () => {
  it('대상으로 거르기, 기록을 누르면 상세', async () => {
    const { r1 } = await seed();
    const router = renderApp('/history');
    expect(await screen.findByText('행사 › 콘서트')).toBeInTheDocument();
    expect(screen.getByText('22,000원')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '전체 대상 ▾' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: '대상' })).getByRole('button', { name: '가수 A' }));
    await waitFor(() => expect(screen.queryByText('22,000원')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: /가수 A/ }));
    expect(router.state.location.pathname).toBe(`/records/${r1.id}`);
  });

  it('선택 모드에서 여러 건 삭제 → 되돌리기', async () => {
    await seed();
    renderApp('/history');
    await userEvent.click(await screen.findByRole('button', { name: '선택' }));
    for (const c of screen.getAllByRole('checkbox')) await userEvent.click(c);
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dlg = screen.getByRole('alertdialog', { name: '기록 2건을 삭제할까요?' });
    expect(dlg).toHaveTextContent('합계 176,000원');
    await userEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(async () => expect(await db.records.count()).toBe(0));
    await userEvent.click(await screen.findByRole('button', { name: '되돌리기' }));
    await waitFor(async () => expect(await db.records.count()).toBe(2));
  });

  it('선택 모드에서 옮기기', async () => {
    const { b, r1 } = await seed();
    renderApp('/history');
    await userEvent.click(await screen.findByRole('button', { name: '선택' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /가수 A/ }));
    await userEvent.click(screen.getByRole('button', { name: '옮기기' }));
    const sheet = screen.getByRole('dialog', { name: '기록 1건 옮기기' });
    await userEvent.click(within(within(sheet).getByRole('radiogroup', { name: '대상' })).getByRole('radio', { name: '가수 B' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '행사' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '옮기기' }));
    await waitFor(async () => expect((await db.records.get(r1.id))!.targetId).toBe(b.id));
    expect((await db.records.get(r1.id))!.etcText).toBe('행사 > 콘서트');
  });
});

describe('목록 삭제 확인 창 (U2-5)', () => {
  it('분류 삭제 문구의 건수가 실제와 같고, 삭제하면 기록이 기타로', async () => {
    const { a, ev, r1 } = await seed();
    renderApp(`/record/${a.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '편집' }));
    await userEvent.click(await screen.findByRole('button', { name: '행사 메뉴' }));
    await userEvent.click(screen.getByRole('button', { name: '행사 삭제' }));
    const dlg = await screen.findByRole('alertdialog', { name: '가수 A의 행사를 삭제할까요?' });
    expect(dlg).toHaveTextContent('가수 A에서만 행사와 세부 버튼 6개가 사라져요. 기록 1건은 가수 A › 기타 › 기타로 옮겨지고');
    await userEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(async () => expect(await db.categories.get(ev.id)).toBeUndefined());
    expect((await db.records.get(r1.id))!.etcText).toBe('행사 > 콘서트');
  });

  it('대상 지출 데이터만 삭제', async () => {
    const { a } = await seed();
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: '편집' }));
    await userEvent.click(await screen.findByRole('button', { name: '가수 A 메뉴' }));
    await userEvent.click(screen.getByRole('button', { name: '지출 데이터만 삭제' }));
    const dlg = await screen.findByRole('alertdialog', { name: '가수 A의 기록만 삭제할까요?' });
    expect(dlg).toHaveTextContent('기록 1건이 삭제돼요.');
    await userEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(async () => expect(await db.records.where('targetId').equals(a.id).count()).toBe(0));
    expect(await db.targets.get(a.id)).toBeDefined();
  });
});

describe('프리셋 화면 (U2-7)', () => {
  it('세부를 넣으면 적용 범위를 묻고, 대상 전체면 대상에도 들어감', async () => {
    const { a, b, ev } = await seed();
    renderApp('/settings/presets');
    await userEvent.click((await screen.findAllByRole('button', { expanded: false })).find((el) => el.textContent?.startsWith('행사'))!);
    await userEvent.click(screen.getByRole('button', { name: '+ 세부' }));
    const sheet = await screen.findByRole('dialog', { name: '세부 추가' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '시상식');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    const scope = await screen.findByRole('dialog', { name: '어디에 적용할까요?' });
    await userEvent.click(within(scope).getByRole('button', { name: /대상 전체/ }));
    await waitFor(async () => expect((await listDetails(db, ev.id)).map((d) => d.name)).toContain('시상식'));
    const evB = (await listCategories(db, b.id))[0];
    expect((await listDetails(db, evB.id)).map((d) => d.name)).toContain('시상식');
    expect(a).toBeDefined();
  });

  it('이 프리셋으로 만든 대상이 없으면 묻지 않음', async () => {
    await markBasePresetsAsked(db);
    await createBasePresets(db, ['취미용']);
    renderApp('/settings/presets');
    await userEvent.click(await screen.findByRole('button', { name: '+ 분류 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '분류 추가' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '이름' }), '여행');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    await waitFor(async () => expect((await listPresets(db))[0].items.map((i) => i.name)).toContain('여행'));
    expect(screen.queryByRole('dialog', { name: '어디에 적용할까요?' })).not.toBeInTheDocument();
  });

  it('기본 프리셋 추가: 이미 있는 건 건너뜀', async () => {
    await seed();
    renderApp('/settings/presets');
    await userEvent.click(await screen.findByRole('button', { name: '기본 프리셋 추가' }));
    const dlg = await screen.findByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
    expect(within(dlg).getByRole('checkbox', { name: /가수용/ })).toBeDisabled();
    await userEvent.click(within(dlg).getByRole('button', { name: '1개 만들기' }));
    await waitFor(async () => expect((await listPresets(db)).map((p) => p.name)).toEqual(['가수용', '배우용']));
  });
});
