import { useState } from 'react';
import { getDb } from '../../data/db';
import { clearRecords, deleteCategory, deleteDetail, deleteImpact, deleteTarget, type DeleteImpact } from '../../data/repo/edit';
import { ListError, renameItem, reorderItems, type ListKind } from '../../data/repo/lists';
import type { EditableItem, ItemAction } from '../../components/EditableList';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { NameSheet } from '../../components/NameSheet';
import { useToast } from '../../components/Toast';
import { josa } from '../../domain/name';

export interface ListContext {
  targetName?: string;
  categoryName?: string;
}

interface Pending {
  item: EditableItem;
  action: 'delete' | 'clearData';
  impact: DeleteImpact;
}

/** 확인 창 문구(STORYBOARD 10장) */
export function confirmText(kind: ListKind, p: Pending, ctx: ListContext): { title: string; body: string } {
  const n = p.item.name;
  const { records, songs, details } = p.impact;
  if (p.action === 'clearData') {
    const where = kind === 'target' ? n : kind === 'category' ? `${ctx.targetName} › ${n}` : `${ctx.targetName} › ${ctx.categoryName} › ${n}`;
    const keep = kind === 'target' ? '분류, 세부, 응원법은 그대로 남아요.' : kind === 'category' ? '분류와 세부 버튼은 그대로 남아요.' : '세부 버튼은 그대로 남아요.';
    return { title: `${where}의 기록만 삭제할까요?`, body: `기록 ${records}건이 삭제돼요. ${keep}` };
  }
  if (kind === 'target') return { title: `${josa(n, '을/를')} 삭제할까요?`, body: `분류, 세부, 지출 기록 ${records}건, 응원법 ${songs}곡이 모두 지워져요.` };
  if (kind === 'category') {
    return {
      title: `${ctx.targetName}의 ${josa(n, '을/를')} 삭제할까요?`,
      body: `${ctx.targetName}에서만 ${josa(n, '과/와')} 세부 버튼 ${details}개가 사라져요. 기록 ${records}건은 ${ctx.targetName} › 기타 › 기타로 옮겨지고, 기타 내용에 이전 이름이 들어가요.`,
    };
  }
  return {
    title: `${josa(n, '을/를')} 삭제할까요?`,
    body: `${ctx.targetName} › ${ctx.categoryName}에서만 ${josa(n, '이/가')} 사라져요. 기록 ${records}건은 ${ctx.targetName} › ${ctx.categoryName} › 기타로 옮겨지고, 기타 내용에 "${n}"${josa(n, '이/가').slice(n.length)} 들어가요.`,
  };
}

/** 편집 모드의 이름 바꾸기·순서 바꾸기·삭제·데이터만 삭제 */
export function useListActions(kind: ListKind, ctx: ListContext = {}) {
  const toast = useToast();
  const [renaming, setRenaming] = useState<EditableItem | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const onReorder = (ids: string[]) => { void reorderItems(getDb(), kind, ids); };
  const onAction = async (item: EditableItem, action: ItemAction) => {
    if (action === 'rename') { setRenaming(item); return; }
    setPending({ item, action, impact: await deleteImpact(getDb(), kind, item.id) });
  };
  const run = async () => {
    if (!pending) return;
    const db = getDb();
    const { item, action } = pending;
    setPending(null);
    if (action === 'clearData') {
      const n = await clearRecords(db, kind, item.id);
      toast(`기록 ${n}건을 삭제했어요`);
      return;
    }
    if (kind === 'target') await deleteTarget(db, item.id);
    else if (kind === 'category') await deleteCategory(db, item.id);
    else await deleteDetail(db, item.id);
    toast(`${josa(item.name, '을/를')} 삭제했어요`);
  };
  const text = pending ? confirmText(kind, pending, ctx) : null;

  const sheet = (
    <>
      <NameSheet
        open={!!renaming}
        title="이름 바꾸기"
        kicker={renaming?.name}
        initial={renaming?.name ?? ''}
        submitLabel="변경"
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          try {
            const n = await renameItem(getDb(), kind, renaming!.id, name);
            setRenaming(null);
            toast(`이름을 ${josa(n, '으로/로')} 바꿨어요`);
            return null;
          } catch (e) {
            if (e instanceof ListError) return e.reason;
            throw e;
          }
        }}
      />
      <ConfirmDialog
        open={!!pending}
        title={text?.title ?? ''}
        body={text?.body}
        confirmLabel="삭제"
        onCancel={() => setPending(null)}
        onConfirm={() => void run()}
      />
    </>
  );
  return { onReorder, onAction: (i: EditableItem, a: ItemAction) => void onAction(i, a), sheet };
}
