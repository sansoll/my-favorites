import { groupHistory } from '../../domain/history';
import { freshDb } from '../../test/db';
import { newId, type FavoritesDB } from '../db';
import type { SpendRecord } from '../types';
import {
  addPreset, applyToItems, changePreset, clearRecords, deleteCategory, deleteDetail, deleteImpact, deleteRecords, deleteTarget,
  EditError, mapToTarget, moveRecords, presetUsers, restoreRecords, updateRecord,
} from './edit';
import { addCategory, addDetail, addTarget, listCategories, listDetails, ListError } from './lists';
import { createBasePresets, listPresets } from './presets';
import { saveRecord } from './records';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

async function singer(name = '가수 A') {
  if (!(await listPresets(db)).length) await createBasePresets(db, ['가수용']);
  const t = await addTarget(db, name, (await listPresets(db))[0]);
  const cats = await listCategories(db, t.id);
  const event = cats.find((c) => c.name === '행사')!;
  const dets = await listDetails(db, event.id);
  return { t, cats, event, concert: dets.find((d) => d.name === '콘서트')!, eventEtc: dets.find((d) => d.isEtc)!, catEtc: cats.find((c) => c.isEtc)! };
}

const rec = (o: Partial<SpendRecord>): SpendRecord => ({ id: newId(), date: '2026-11-13', targetId: 'a', categoryId: 'c', detailId: 'd', etcText: '', paid: 1, refund: 0, memo: '', createdAt: 0, updatedAt: 0, ...o });

describe('내역 조회 (U2-1)', () => {
  it('최신 날짜순, 날짜별로 묶음, 대상·기간으로 거르기', () => {
    const rs = [
      rec({ date: '2026-11-13', createdAt: 1, paid: 1 }), rec({ date: '2026-11-13', createdAt: 2, paid: 2 }),
      rec({ date: '2026-11-14', paid: 3, targetId: 'b' }), rec({ date: '2026-10-31', paid: 4 }), rec({ date: '2025-12-01', paid: 5 }),
    ];
    const g = groupHistory(rs, { targetId: null, period: 'all' }, '2026-11-13');
    expect(g.map((x) => [x.date, x.records.map((r) => r.paid)])).toEqual([
      ['2026-11-14', [3]], ['2026-11-13', [2, 1]], ['2026-10-31', [4]], ['2025-12-01', [5]],
    ]);
    expect(groupHistory(rs, { targetId: 'b', period: 'all' }, '2026-11-13').map((x) => x.date)).toEqual(['2026-11-14']);
    expect(groupHistory(rs, { targetId: null, period: 'thisMonth' }, '2026-11-13').length).toBe(2);
    expect(groupHistory(rs, { targetId: null, period: 'lastMonth' }, '2026-11-13').map((x) => x.date)).toEqual(['2026-10-31']);
    expect(groupHistory(rs, { targetId: null, period: 'lastYear' }, '2026-11-13').map((x) => x.date)).toEqual(['2025-12-01']);
  });
});

describe('기록 수정 규칙 (U2-2)', () => {
  it('환불이 결제보다 크면 저장 안 됨, 전액 환불은 남음', async () => {
    const { t, event, concert } = await singer();
    const r = await saveRecord(db, { targetId: t.id, categoryId: event.id, detailId: concert.id, paid: 154000 });
    const base = { date: r.date, targetId: t.id, categoryId: event.id, detailId: concert.id, paid: 154000, memo: '', etcText: '' };
    await expect(updateRecord(db, r.id, { ...base, refund: 154001 })).rejects.toEqual(new EditError('refund'));
    await updateRecord(db, r.id, { ...base, refund: 154000 });
    expect((await db.records.get(r.id))!.refund).toBe(154000);
    await expect(updateRecord(db, r.id, { ...base, paid: 0, refund: 0 })).rejects.toEqual(new EditError('amount'));
  });

  it('대상을 바꾸면 같은 이름의 분류·세부를 찾음', async () => {
    const a = await singer('가수 A');
    const b = await singer('가수 B');
    const r = await saveRecord(db, { targetId: a.t.id, categoryId: a.event.id, detailId: a.concert.id, paid: 1 });
    expect(await mapToTarget(db, r, b.t.id)).toEqual({ categoryId: b.event.id, detailId: b.concert.id, etcText: '' });
  });

  it('없으면 기타로 가고 기타 내용에 이전 이름', async () => {
    const a = await singer('가수 A');
    const w = await addTarget(db, '웹툰 G');
    const r = await saveRecord(db, { targetId: a.t.id, categoryId: a.event.id, detailId: a.concert.id, paid: 1 });
    const m = await mapToTarget(db, r, w.id);
    expect(m.etcText).toBe('행사 > 콘서트');
    expect((await db.details.get(m.detailId))!.isEtc).toBe(true);
    // 분류는 있는데 세부가 없을 때
    const e = await addCategory(db, w.id, '행사');
    const m2 = await mapToTarget(db, { ...r, etcText: '1층' }, w.id);
    expect(m2.categoryId).toBe(e.id);
    expect(m2.etcText).toBe('콘서트 · 1층');
  });
});

describe('기록 삭제·되돌리기·옮기기 (U2-4)', () => {
  it('삭제 후 되돌리기로 복구', async () => {
    const { t, event } = await singer();
    const r1 = await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 1 });
    const r2 = await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 2 });
    const snap = await deleteRecords(db, [r1.id, r2.id]);
    expect(await db.records.count()).toBe(0);
    await restoreRecords(db, snap);
    expect((await db.records.toArray()).map((r) => r.paid).sort()).toEqual([1, 2]);
  });

  it('여러 건 옮기기, 세부를 안 고르면 기타 + 이전 이름', async () => {
    const a = await singer('가수 A');
    const b = await singer('가수 B');
    const r1 = await saveRecord(db, { targetId: a.t.id, categoryId: a.event.id, detailId: a.concert.id, paid: 1 });
    const r2 = await saveRecord(db, { targetId: a.t.id, categoryId: a.event.id, paid: 2, etcText: '응원봉' });
    expect(await moveRecords(db, [r1.id, r2.id], { targetId: b.t.id, categoryId: b.event.id })).toBe(2);
    const [m1, m2] = await db.records.bulkGet([r1.id, r2.id]);
    expect(m1).toMatchObject({ targetId: b.t.id, detailId: b.eventEtc.id, etcText: '행사 > 콘서트' });
    expect(m2).toMatchObject({ targetId: b.t.id, detailId: b.eventEtc.id, etcText: '행사 · 응원봉' });
    await moveRecords(db, [r1.id], { targetId: b.t.id, categoryId: b.event.id, detailId: b.concert.id });
    expect((await db.records.get(r1.id))!.etcText).toBe('');
  });
});

describe('목록 삭제 규칙 (U2-5)', () => {
  it('대상 삭제 → 분류·세부·기록·응원법 모두 삭제, 확인 건수가 실제와 같음', async () => {
    const { t, event } = await singer();
    await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 1 });
    await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 1 });
    await db.songs.add({ id: 's', targetId: t.id, title: '곡 1', lyrics: '', layer: { marks: [], extras: [] }, links: [], createdAt: 0 });
    await db.checkItems.add({ id: 'ci', targetId: t.id, name: '버블', on: true, order: 1 });
    expect(await deleteImpact(db, 'target', t.id)).toEqual({ records: 2, songs: 1, details: 0 });
    await deleteTarget(db, t.id);
    expect(await db.categories.where('targetId').equals(t.id).count()).toBe(0);
    expect(await db.records.count()).toBe(0);
    expect(await db.songs.count()).toBe(0);
    expect(await db.checkItems.count()).toBe(0);
    expect(await db.details.where('categoryId').equals(event.id).count()).toBe(0);
  });

  it('분류 삭제 → 기록이 기타 › 기타, 기타 내용에 이전 이름(있던 글은 뒤에)', async () => {
    const { t, event, concert, catEtc } = await singer();
    const r1 = await saveRecord(db, { targetId: t.id, categoryId: event.id, detailId: concert.id, paid: 1 });
    const r2 = await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 1, etcText: '응원봉' });
    expect(await deleteImpact(db, 'category', event.id)).toEqual({ records: 2, songs: 0, details: 6 });
    expect(await deleteCategory(db, event.id)).toBe(2);
    const etcDet = (await listDetails(db, catEtc.id))[0];
    expect(await db.records.get(r1.id)).toMatchObject({ categoryId: catEtc.id, detailId: etcDet.id, etcText: '행사 > 콘서트' });
    expect((await db.records.get(r2.id))!.etcText).toBe('행사 · 응원봉');
    expect(await db.categories.get(event.id)).toBeUndefined();
  });

  it('세부 삭제 → 같은 분류의 기타, 기타 내용에 세부 이름', async () => {
    const { t, event, concert, eventEtc } = await singer();
    const r = await saveRecord(db, { targetId: t.id, categoryId: event.id, detailId: concert.id, paid: 1 });
    await deleteDetail(db, concert.id);
    expect(await db.records.get(r.id)).toMatchObject({ detailId: eventEtc.id, etcText: '콘서트' });
  });

  it('기타는 삭제 안 됨', async () => {
    const { catEtc, eventEtc } = await singer();
    await expect(deleteCategory(db, catEtc.id)).rejects.toEqual(new ListError('etc'));
    await expect(deleteDetail(db, eventEtc.id)).rejects.toEqual(new ListError('etc'));
  });

  it('데이터만 삭제 → 항목은 남고 기록만 삭제(대상이면 응원법 유지)', async () => {
    const { t, event } = await singer();
    await saveRecord(db, { targetId: t.id, categoryId: event.id, paid: 1 });
    await db.songs.add({ id: 's', targetId: t.id, title: '곡 1', lyrics: '', layer: { marks: [], extras: [] }, links: [], createdAt: 0 });
    expect(await clearRecords(db, 'target', t.id)).toBe(1);
    expect(await db.records.count()).toBe(0);
    expect(await db.songs.count()).toBe(1);
    expect(await db.categories.get(event.id)).toBeDefined();
  });

  it('분류를 지우면 그 분류의 정기 결제도 기타로', async () => {
    const { t, event, concert, catEtc } = await singer();
    await db.recurrings.add({ id: 'rc', targetId: t.id, categoryId: event.id, detailId: concert.id, amount: 1, day: 1, enabled: true, lastMonth: '' });
    await deleteCategory(db, event.id);
    expect((await db.recurrings.get('rc'))!.categoryId).toBe(catEtc.id);
  });
});

describe('프리셋 관리와 적용 범위 (U2-6)', () => {
  it('프리셋에만', async () => {
    const a = await singer('가수 A');
    const p = (await listPresets(db))[0];
    await changePreset(db, p.id, { op: 'addCategory', category: '여행' }, 'only');
    expect((await db.presets.get(p.id))!.items.map((i) => i.name)).toContain('여행');
    expect((await listCategories(db, a.t.id)).map((c) => c.name)).not.toContain('여행');
  });

  it('대상 전체: 추가는 같은 이름 건너뛰고, 빼면 기록을 기타로', async () => {
    const a = await singer('가수 A');
    const b = await singer('가수 B');
    await addCategory(db, b.t.id, '여행');
    const p = (await listPresets(db))[0];
    expect((await presetUsers(db, p.id)).map((x) => x.name)).toEqual(['가수 A', '가수 B']);
    await changePreset(db, p.id, { op: 'addCategory', category: '여 행' }, 'all');
    expect((await listCategories(db, a.t.id)).map((c) => c.name)).toEqual(['행사', '경비', '상품', '멤버십', '서포트', '여 행', '기타']);
    expect((await listCategories(db, b.t.id)).filter((c) => c.name.replace(/\s/g, '') === '여행').length).toBe(1);

    const r = await saveRecord(db, { targetId: a.t.id, categoryId: a.event.id, detailId: a.concert.id, paid: 1 });
    await changePreset(db, p.id, { op: 'removeDetail', category: '행사', detail: '콘서트' }, 'all');
    expect(await db.records.get(r.id)).toMatchObject({ detailId: a.eventEtc.id, etcText: '콘서트' });
    expect((await listDetails(db, b.event.id)).map((d) => d.name)).not.toContain('콘서트');
  });

  it('대상 골라서', async () => {
    const a = await singer('가수 A');
    const b = await singer('가수 B');
    const p = (await listPresets(db))[0];
    await changePreset(db, p.id, { op: 'addDetail', category: '행사', detail: '시상식' }, [b.t.id]);
    expect((await listDetails(db, a.event.id)).map((d) => d.name)).not.toContain('시상식');
    const bd = (await listDetails(db, b.event.id)).map((d) => d.name);
    expect(bd.slice(-2)).toEqual(['시상식', '기타']);
  });

  it('프리셋 내용 바꾸기 규칙', () => {
    const items = [{ name: '행사', details: ['콘서트'] }];
    expect(applyToItems(items, { op: 'addDetail', category: '행사', detail: '콘 서트' })).toEqual(items);
    expect(applyToItems(items, { op: 'addCategory', category: '기타' })).toEqual(items);
    expect(applyToItems(items, { op: 'removeCategory', category: '행 사' })).toEqual([]);
  });

  it('새 프리셋 이름 검사', async () => {
    await createBasePresets(db, ['가수용']);
    await expect(addPreset(db, '가수 용')).rejects.toEqual(new ListError('duplicate'));
    expect((await addPreset(db, ' 게임용 ')).name).toBe('게임용');
  });
});

it('addDetail도 기타 앞에', async () => {
  const t = await addTarget(db, 'x');
  const c = await addCategory(db, t.id, '행사');
  await addDetail(db, c.id, '콘서트');
  expect((await listDetails(db, c.id)).map((d) => d.name)).toEqual(['콘서트', '기타']);
});
