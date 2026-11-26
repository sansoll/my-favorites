import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

test('첫 실행 → 대상 추가(프리셋) → 기록 저장 → 첫 화면 금액 반영 (S1 일부)', async ({ page }) => {
  await page.goto('./');
  await closePresetDialog(page, true);

  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '새 대상' });
  await sheet.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await sheet.getByRole('radio', { name: '가수용' }).click();
  await sheet.getByRole('button', { name: '추가' }).click();

  await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
  await page.getByRole('button', { name: /^행사/ }).click();
  await page.getByRole('button', { name: /^콘서트/ }).click();
  for (const k of ['1', '5', '4', '00', '0']) await page.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('status')).toContainText('가수 A › 행사 › 콘서트 154,000원을 저장했어요');
  await expect(page.getByRole('link', { name: /이번 달 지출/ })).toContainText('154,000원');
  await expect(page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ })).toContainText('154,000원');

  // 다시 열어도 남아 있음
  await page.reload();
  await expect(page.getByRole('link', { name: /이번 달 지출/ })).toContainText('154,000원');
  await expect(page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' })).toBeHidden();
});
