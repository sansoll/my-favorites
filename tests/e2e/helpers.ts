import { expect, type Page } from '@playwright/test';

/** 처음 설치하면 나오는 튜토리얼을 건너뛰고, 이어서 나오는 기본 프리셋 창을 닫습니다. */
export async function closePresetDialog(page: Page, make = false) {
  await page.getByRole('button', { name: '건너뛰기' }).click();
  const dlg = page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: make ? /개 만들기/ : '나중에' }).click();
  await expect(dlg).toBeHidden();
}
