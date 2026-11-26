import { expect, type Page } from '@playwright/test';

/** 첫 실행의 기본 프리셋 창을 닫습니다. */
export async function closePresetDialog(page: Page, make = false) {
  const dlg = page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: make ? /개 만들기/ : '나중에' }).click();
  await expect(dlg).toBeHidden();
}
