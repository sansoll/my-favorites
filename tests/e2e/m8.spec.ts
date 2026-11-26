import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

test('곡 추가 → 떼창 색칠·추가 응원 → 응원법·원본·외우기 → 가사 수정 후 유지 → 공연장 모드 (S9)', async ({ page }) => {
  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();

  await page.getByRole('link', { name: '응원법' }).click();
  await page.getByRole('button', { name: '+ 곡 추가' }).click();
  const dlg = page.getByRole('dialog', { name: '곡 추가' });
  await dlg.getByRole('textbox', { name: '제목' }).fill('곡 1');
  await dlg.getByRole('textbox', { name: '가사 붙여넣기' }).fill('첫 줄 가사\n다 같이 불러요\n마지막 줄');
  await dlg.getByRole('button', { name: '저장하고 응원법 표시하기' }).click();

  const lyrics = page.getByLabel('가사');
  await lyrics.getByRole('button', { name: '다', exact: true }).click();
  await lyrics.getByRole('button', { name: '같이', exact: true }).click();
  await page.getByRole('radio', { name: '추가 응원 넣기' }).click();
  await lyrics.getByRole('button', { name: '불러요', exact: true }).click();
  const ex = page.getByRole('dialog', { name: '추가 응원 넣기' });
  await ex.getByRole('radio', { name: '줄 아래' }).click();
  await ex.getByRole('textbox', { name: '구호' }).fill('하나 둘 셋');
  await ex.getByRole('button', { name: '넣기' }).click();
  await page.getByRole('button', { name: '완료' }).click();

  await expect(lyrics.locator('mark')).toHaveText(['다', '같이']);
  await expect(lyrics.getByText('「 하나 둘 셋 」')).toBeVisible();
  await page.getByRole('radio', { name: '원본' }).click();
  await expect(lyrics.locator('mark')).toHaveCount(0);
  await expect(lyrics.getByText(/하나 둘 셋/)).toHaveCount(0);
  await page.getByRole('radio', { name: '외우기' }).click();
  await expect(page.getByRole('button', { name: /가린/ })).toHaveCount(3);

  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('button', { name: '가사 수정' }).click();
  await page.getByRole('dialog', { name: '가사 수정' }).getByRole('textbox').fill('첫 줄 바꿈\n다 같이 불러요\n마지막 줄');
  await page.getByRole('button', { name: '가사 저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '고친 줄 1개' })).toBeVisible();
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('radio', { name: '응원법' }).click();
  await expect(lyrics.locator('mark')).toHaveText(['다', '같이']);

  await page.getByRole('button', { name: '공연장 모드' }).click();
  const stage = page.getByRole('dialog', { name: '공연장 모드' });
  await expect(stage).toBeVisible();
  await expect(stage.getByText('「 하나 둘 셋 」')).toBeVisible();
  await stage.getByRole('button', { name: '닫기' }).click();

  await page.reload();
  await expect(lyrics.locator('mark')).toHaveText(['다', '같이']);
  await page.getByRole('link', { name: '곡 목록으로' }).click();
  await expect(page.getByRole('link', { name: /곡 1/ })).toContainText('펼침 1번');
});
