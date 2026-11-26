import { BASE_PRESETS } from '../../domain/presets';
import { monthTotals } from '../../domain/totals';
import { freshDb } from '../../test/db';
import type { FavoritesDB } from '../db';
import {
  addCategory, addDetail, addTarget, ensureInitialData, listCategories, listDetails, listTargets, ListError, renameItem, reorderItems,
} from './lists';
import { createBasePresets, listPresets, markBasePresetsAsked, shouldAskBasePresets } from './presets';
import { recentRecords, RecordError, saveRecord } from './records';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe('대상·분류·세부 (U1-1)', () => {
  it('처음에는 대상 기타만 있고, 두 번 불러도 하나', async () => {
    await ensureInitialData(db);
    await ensureInitialData(db);
    const ts = await listTargets(db);
    expect(names(ts)).toEqual(['기타']);
    const cs = await listCategories(db, ts[0].id);
    expect(cs.map((c) => [c.name, c.isEtc])).toEqual([['기타', true]]);
    expect(names(await listDetails(db, cs[0].id))).toEqual(['기타']);
  });

  it('대상을 만들면 분류 기타와 세부 기타가 자동으로 생기고, 기타 앞에 들어감', async () => {
    await ensureInitialData(db);
    const t = await addTarget(db, ' 가수 A ');
    expect(t.name).toBe('가수 A');
    expect(names(await listTargets(db))).toEqual(['가수 A', '기타']);
    const cs = await listCategories(db, t.id);
    expect(names(cs)).toEqual(['기타']);
    expect((await listDetails(db, cs[0].id)).map((d) => d.isEtc)).toEqual([true]);
  });

  it('같은 목록에 같은 이름(공백 무시)은 안 만들어짐', async () => {
    const t = await addTarget(db, '가수 A');
    await expect(addTarget(db, '가수A')).rejects.toEqual(new ListError('duplicate'));
    const c = await addCategory(db, t.id, '팬 미팅');
    await expect(addCategory(db, t.id, '팬미팅')).rejects.toEqual(new ListError('duplicate'));
    await expect(addCategory(db, t.id, '기 타')).rejects.toEqual(new ListError('duplicate'));
    await addDetail(db, c.id, '1부');
    await expect(addDetail(db, c.id, ' 1부 ')).rejects.toEqual(new ListError('duplicate'));
    await expect(addTarget(db, '   ')).rejects.toEqual(new ListError('empty'));
  });

  it('분류와 세부는 대상마다 따로', async () => {
    const a = await addTarget(db, '가수 A');
    const b = await addTarget(db, '가수 B');
    await addCategory(db, a.id, '행사');
    await addCategory(db, b.id, '행사');
    expect(names(await listCategories(db, a.id))).toEqual(['행사', '기타']);
    expect(names(await listCategories(db, b.id))).toEqual(['행사', '기타']);
  });

  it('기타는 이름을 바꿀 수 없음', async () => {
    await ensureInitialData(db);
    const etc = (await listTargets(db))[0];
    await expect(renameItem(db, 'target', etc.id, '다른 것')).rejects.toEqual(new ListError('etc'));
  });

  it('이름을 바꾸면 지난 기록에도 새 이름이 보임', async () => {
    const t = await addTarget(db, '가수 A');
    const c = await addCategory(db, t.id, '행사');
    const r = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1000, date: '2026-11-01' });
    await renameItem(db, 'category', c.id, '공연');
    const rec = await db.records.get(r.id);
    expect((await db.categories.get(rec!.categoryId))!.name).toBe('공연');
    await expect(renameItem(db, 'category', c.id, '기타')).rejects.toEqual(new ListError('duplicate'));
  });

  it('순서 바꾸기가 저장됨', async () => {
    await ensureInitialData(db);
    const a = await addTarget(db, '가수 A');
    const d = await addTarget(db, '가수 D');
    const etc = (await listTargets(db)).find((t) => t.isEtc)!;
    await reorderItems(db, 'target', [d.id, etc.id, a.id]);
    expect(names(await listTargets(db))).toEqual(['가수 D', '기타', '가수 A']);
    // 새로 만들면 기타 앞(일반 항목 맨 뒤)에 들어감
    await addTarget(db, '배우 E');
    expect(names(await listTargets(db))).toEqual(['가수 D', '기타', '가수 A', '배우 E']);
  });
});

describe('새 대상에 프리셋 적용 (U1-2)', () => {
  it('프리셋의 분류·세부가 복사됨', async () => {
    await createBasePresets(db, ['가수용']);
    const p = (await listPresets(db))[0];
    const t = await addTarget(db, '가수 A', p);
    const cs = await listCategories(db, t.id);
    expect(names(cs)).toEqual(['행사', '경비', '상품', '멤버십', '서포트', '기타']);
    expect(names(await listDetails(db, cs[0].id))).toEqual(['콘서트', '팬콘서트', '팬미팅', '팬싸인회', '팝업', '생일카페', '기타']);
    expect(names(await listDetails(db, cs[4].id))).toEqual(['기타']);
    expect(t.presetId).toBe(p.id);
  });

  it('빈 목록이면 기타만', async () => {
    const t = await addTarget(db, '웹툰 G');
    expect(names(await listCategories(db, t.id))).toEqual(['기타']);
  });

  it('복사 후 프리셋을 고쳐도 대상은 안 바뀜', async () => {
    await createBasePresets(db, ['배우용']);
    const p = (await listPresets(db))[0];
    const t = await addTarget(db, '배우 E', p);
    await db.presets.update(p.id, { items: [{ name: '전혀 다른 분류', details: [] }] });
    expect(names(await listCategories(db, t.id))).toEqual(['행사', '경비', '상품', '멤버십', '기타']);
  });
});

describe('기록 저장 saveRecord (U1-3)', () => {
  async function setup() {
    await createBasePresets(db, ['가수용']);
    const t = await addTarget(db, '가수 A', (await listPresets(db))[0]);
    const cs = await listCategories(db, t.id);
    const ds = await listDetails(db, cs[0].id);
    return { t, c: cs[0], concert: ds[0], etc: ds[ds.length - 1] };
  }

  it('금액 0이면 저장 안 됨', async () => {
    const { t, c } = await setup();
    await expect(saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 0 })).rejects.toEqual(new RecordError('amount'));
    expect(await db.records.count()).toBe(0);
  });

  it('세부를 건너뛰면 그 분류의 기타, 기타 내용이 저장됨(빈 칸 허용)', async () => {
    const { t, c, etc } = await setup();
    const r1 = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 5000, etcText: ' 응원봉 ' });
    expect(r1.detailId).toBe(etc.id);
    expect(r1.etcText).toBe('응원봉');
    const r2 = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 5000 });
    expect(r2.etcText).toBe('');
  });

  it('기타가 아닌 세부면 기타 내용은 남기지 않음', async () => {
    const { t, c, concert } = await setup();
    const r = await saveRecord(db, { targetId: t.id, categoryId: c.id, detailId: concert.id, paid: 154000, etcText: 'x' });
    expect(r.etcText).toBe('');
    expect(r).toMatchObject({ paid: 154000, refund: 0, memo: '' });
  });

  it('미래 날짜도 저장(예정), 메모·장소는 없어도 저장', async () => {
    const { t, c, concert } = await setup();
    const r = await saveRecord(db, { targetId: t.id, categoryId: c.id, detailId: concert.id, paid: 1, date: '2099-01-01' });
    expect(r.date).toBe('2099-01-01');
    expect(r.placeId).toBeUndefined();
  });

  it('다른 대상의 분류로는 저장 안 됨', async () => {
    const { c } = await setup();
    const other = await addTarget(db, '가수 B');
    await expect(saveRecord(db, { targetId: other.id, categoryId: c.id, paid: 1 })).rejects.toEqual(new RecordError('list'));
  });
});

describe('이번 달 금액 집계 (U1-4)', () => {
  it('대상·분류·세부별 합계 = 결제 − 환불, 예정 포함, 다른 달은 빠짐', async () => {
    const t = await addTarget(db, '가수 A');
    const c = await addCategory(db, t.id, '행사');
    const d = await addDetail(db, c.id, '콘서트');
    await saveRecord(db, { targetId: t.id, categoryId: c.id, detailId: d.id, paid: 154000, date: '2026-11-13' });
    await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 4500, date: '2026-11-30' });
    await saveRecord(db, { targetId: t.id, categoryId: c.id, detailId: d.id, paid: 99000, date: '2026-10-31' });
    const first = (await db.records.where('date').equals('2026-11-13').first())!;
    await db.records.update(first.id, { refund: 30000 });
    const m = monthTotals(await db.records.toArray(), '2026-11');
    expect(m.total).toBe(128500);
    expect(m.byTarget.get(t.id)).toBe(128500);
    expect(m.byCategory.get(c.id)).toBe(128500);
    expect(m.byDetail.get(d.id)).toBe(124000);
  });
});

describe('기본 프리셋 (U1-7 저장 규칙)', () => {
  it('한 번만 묻고, 체크한 것만 만들고, 같은 이름은 건너뜀', async () => {
    expect(await shouldAskBasePresets(db)).toBe(true);
    await markBasePresetsAsked(db);
    expect(await shouldAskBasePresets(db)).toBe(false);
    expect(await createBasePresets(db, ['가수용', '취미용'])).toEqual(['가수용', '취미용']);
    expect(await createBasePresets(db, ['가수용', '배우용'])).toEqual(['배우용']);
    expect(names(await listPresets(db))).toEqual(['가수용', '취미용', '배우용']);
    expect(BASE_PRESETS.map((b) => b.name)).toEqual(['가수용', '배우용', '취미용']);
  });
});

describe('최근 기록', () => {
  it('최신순 3건, 예정 제외', async () => {
    const t = await addTarget(db, '가수 A');
    const c = await addCategory(db, t.id, '행사');
    for (const [date, paid, at] of [['2026-11-10', 1, 1], ['2026-11-13', 2, 2], ['2026-11-13', 3, 3], ['2026-11-12', 4, 4], ['2026-11-20', 5, 5]] as const) {
      await saveRecord(db, { targetId: t.id, categoryId: c.id, paid, date }, at);
    }
    expect((await recentRecords(db, 3, '2026-11-13')).map((r) => r.paid)).toEqual([3, 2, 4]);
  });
});
