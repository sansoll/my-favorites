import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

test('정기 결제 추가 → 기록 탭 안내 → 앱을 다시 열어도 같은 달은 한 번만 (S3 일부)', async ({ page }) => {
  // 결제일을 내일로 잡아 기록 탭 안내가 보이게 합니다.
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getDate(); });
  await page.goto('./');
  await closePresetDialog(page, true);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('radio', { name: '가수용' }).click();
  await add.getByRole('button', { name: '추가' }).click();

  await page.getByRole('link', { name: '설정' }).click();
  await page.getByRole('link', { name: /정기 결제/ }).click();
  await page.getByRole('button', { name: '+ 정기 결제 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '정기 결제 추가' });
  await sheet.getByRole('radio', { name: '가수 A' }).click();
  await sheet.getByRole('radio', { name: '멤버십' }).click();
  await sheet.getByRole('radio', { name: '버블' }).click();
  await sheet.getByRole('textbox', { name: '금액' }).fill('4500');
  await sheet.getByRole('combobox', { name: '결제일' }).selectOption(String(tomorrow));
  await sheet.getByRole('button', { name: '저장' }).click();
  await page.getByRole('dialog', { name: '이번 달은 어떻게 할까요?' }).getByRole('button', { name: /이번 달부터/ }).click();
  await expect(page.getByRole('list', { name: '정기 결제' })).toContainText(`매달 ${tomorrow}일`);

  await page.getByRole('link', { name: '기록' }).click();
  await expect(page.getByRole('link', { name: /내일 정기 결제가 있어요/ })).toBeVisible();

  const expected = 1;
  await page.reload();
  await page.getByRole('link', { name: '내역' }).click();
  await expect(page.getByText('4,500원').first()).toBeVisible();
  const count = await page.evaluate(async () => {
    const req = indexedDB.open('my-favorites');
    const db: IDBDatabase = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    return new Promise<number>((res) => { const r = db.transaction('records').objectStore('records').count(); r.onsuccess = () => res(r.result); });
  });
  expect(count).toBe(expected);
});
