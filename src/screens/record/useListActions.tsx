import { useState } from 'react';
import { getDb } from '../../data/db';
import { ListError, renameItem, reorderItems, type ListKind } from '../../data/repo/lists';
import type { EditableItem, ItemAction } from '../../components/EditableList';
import { NameSheet } from '../../components/NameSheet';
import { useToast } from '../../components/Toast';
import { josa } from '../../domain/name';

/** 편집 모드의 이름 바꾸기·순서 바꾸기. 삭제와 데이터만 삭제는 M2에서 붙습니다. */
export function useListActions(kind: ListKind) {
  const toast = useToast();
  const [renaming, setRenaming] = useState<EditableItem | null>(null);

  const onReorder = (ids: string[]) => { void reorderItems(getDb(), kind, ids); };
  const onAction = (item: EditableItem, action: ItemAction) => {
    if (action === 'rename') setRenaming(item);
  };
  const sheet = (
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
  );
  return { onReorder, onAction, sheet };
}
