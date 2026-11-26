import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDb } from '../../data/db';
import { addCategory, addDetail, etcDetailOf, ListError, listCategories, listDetails } from '../../data/repo/lists';
import { EditableList } from '../../components/EditableList';
import { NameSheet } from '../../components/NameSheet';
import { useToast } from '../../components/Toast';
import { parseDateStr, today } from '../../domain/date';
import { formatWon } from '../../domain/money';
import { josa } from '../../domain/name';
import { useMonthTotals } from '../../hooks/useMonthTotals';
import u from '../../components/ui.module.css';
import { useListActions } from './useListActions';
import s from './Record.module.css';

/** 기록 2(분류)와 기록 3(세부)은 같은 모양입니다. */
export function ListStepScreen({ step }: { step: 'category' | 'detail' }) {
  const { targetId = '', categoryId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const todayStr = today();
  const month = parseDateStr(todayStr).m;
  const totals = useMonthTotals(todayStr);
  const data = useLiveQuery(async () => {
    const db = getDb();
    const target = await db.targets.get(targetId);
    const category = step === 'detail' ? await db.categories.get(categoryId) : undefined;
    const items = step === 'category' ? await listCategories(db, targetId) : await listDetails(db, categoryId);
    return { target, category, items };
  }, [step, targetId, categoryId]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { onReorder, onAction, sheet } = useListActions(step);

  if (!data) return null;
  if (!data.target || (step === 'detail' && !data.category)) {
    return (
      <div className={s.screen}>
        <p className={s.empty}>찾는 항목이 없어요.</p>
        <Link to="/" className={s.more}>기록 화면으로</Link>
      </div>
    );
  }

  const { target, category, items } = data;
  const byId = step === 'category' ? totals.byCategory : totals.byDetail;
  const sum = step === 'category' ? totals.byTarget.get(target.id) ?? 0 : totals.byCategory.get(category!.id) ?? 0;
  const noun = step === 'category' ? '분류' : '세부';
  const base = `/record/${target.id}`;

  return (
    <div className={s.screen}>
      <div className={s.crumbs}>
        <Link to={step === 'category' ? '/' : base} className={s.back} aria-label="뒤로">‹</Link>
        <Link to={base} className={s.crumb}><span className={s.dot} style={{ background: target.color }} aria-hidden="true" />{target.name}</Link>
        {category && <><span className={s.sep} aria-hidden="true">›</span><span className={s.crumb}>{category.name}</span></>}
        <span className={s.spacer} />
        <button type="button" className={u.ghost} aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? '완료' : '편집'}</button>
      </div>
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h1 className={s.title} style={{ fontSize: '1.25rem' }}>{step === 'category' ? '어디에 썼나요?' : '자세히 고를까요?'}</h1>
          <span className={s.sectionMeta}>{month}월 {formatWon(sum)}</span>
        </div>
        <EditableList
          label={noun}
          items={items.map((x) => ({ id: x.id, name: x.name, isEtc: x.isEtc, amount: byId.get(x.id) ?? 0 }))}
          editing={editing}
          onEditingChange={setEditing}
          onOpen={(x) => nav(step === 'category' ? `${base}/${x.id}` : `${base}/${category!.id}/${x.id}`)}
          onReorder={onReorder}
          onAction={onAction}
          actions={['rename']}
        />
        <button type="button" className={u.dashed} style={{ marginTop: '0.75rem' }} onClick={() => setAdding(true)}>+ {noun} 추가</button>
        {step === 'detail' && (
          <button
            type="button"
            className={u.ghost}
            style={{ marginTop: '0.5rem', minHeight: '3rem', borderRadius: '1.5rem' }}
            onClick={async () => { const etc = await etcDetailOf(getDb(), category!.id); nav(`${base}/${category!.id}/${etc.id}`); }}
          >건너뛰기 · 기타로 저장</button>
        )}
        <p className={u.hint} style={{ marginTop: '0.5rem' }}>길게 누르거나 편집을 누르면 순서와 이름을 바꿀 수 있어요. 금액은 이번 달 기준이에요.</p>
      </section>
      <NameSheet
        open={adding}
        title={`새 ${noun}`}
        kicker={category ? `${target.name} › ${category.name}` : target.name}
        submitLabel="추가"
        onClose={() => setAdding(false)}
        onSubmit={async (name) => {
          try {
            const x = step === 'category' ? await addCategory(getDb(), target.id, name) : await addDetail(getDb(), category!.id, name);
            setAdding(false);
            toast(`${josa(x.name, '을/를')} 추가했어요`);
            return null;
          } catch (e) {
            if (e instanceof ListError) return e.reason;
            throw e;
          }
        }}
      />
      {sheet}
    </div>
  );
}
