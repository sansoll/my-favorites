import { today, toDateStr, type DateStr } from '../domain/date';
import { notifyText, addDays, LEAD_DAYS } from '../domain/recurring';
import type { FavoritesDB } from '../data/db';
import { getNotify, upcomingPayments } from '../data/repo/recurring';
import { getSetting, setSetting } from '../data/settings';

const ASKED_KEY = 'notifyPermissionAsked';
const SENT_KEY = 'recurringNotified';

/** 폰 알림을 보내는 곳. 테스트에서는 가짜로 바꿉니다. */
export interface Notifier {
  permission(): NotificationPermission | 'unsupported';
  request(): Promise<NotificationPermission>;
  show(title: string, body: string, tag: string): Promise<void>;
}

export const browserNotifier: Notifier = {
  permission: () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
  request: () => Notification.requestPermission(),
  async show(title, body, tag) {
    // 안드로이드 크롬은 `new Notification`을 막아서 서비스 워커로 띄웁니다.
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    else new Notification(title, { body, tag });
  },
};

/**
 * 알림 권한은 처음 한 번만 묻습니다(U3-4). 정기 결제를 처음 만들 때(사용자가 누른 직후) 부릅니다.
 * 거부해도 기록 탭 안내와 자동 기록은 그대로입니다.
 */
export async function askPermissionOnce(db: FavoritesDB, n: Notifier = browserNotifier): Promise<void> {
  if (await getSetting(db, ASKED_KEY, false)) return;
  if (n.permission() !== 'default') return;
  await setSetting(db, ASKED_KEY, true);
  try {
    await n.request();
  } catch {
    /* 지원하지 않으면 조용히 넘어감 */
  }
}

/**
 * 앱을 열 때 부릅니다. PWA는 닫혀 있을 때 정해진 시각에 알림을 못 보내서(DESIGN 104),
 * 알림 날(결제일 − 알림 시간)의 설정 시각이 지났고 결제일이 아직 안 지났으면 그때 한 번 보냅니다.
 * 설정에서 알림을 끄면 폰 알림만 멈춥니다.
 */
export async function notifyDue(db: FavoritesDB, now: Date = new Date(), n: Notifier = browserNotifier): Promise<string[]> {
  const settings = await getNotify(db);
  if (!settings.on || n.permission() !== 'granted') return [];
  const todayStr = today(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const lead = LEAD_DAYS[settings.when];
  const sent = new Set(await getSetting<string[]>(db, SENT_KEY, []));
  const out: string[] = [];
  for (const u of await upcomingPayments(db, todayStr)) {
    const alertDay = addDays(u.date, -lead);
    if (todayStr === alertDay && hhmm < settings.time) continue;
    const key = `${u.recurring.id}:${u.date}`;
    if (sent.has(key)) continue;
    const [t, d, c] = await Promise.all([db.targets.get(u.recurring.targetId), db.details.get(u.recurring.detailId), db.categories.get(u.recurring.categoryId)]);
    if (!t) continue;
    const item = d && !d.isEtc ? d.name : c?.name ?? '';
    const body = notifyText(u.diff, t.name, item, u.recurring.amount);
    try {
      await n.show('정기 결제', body, key);
    } catch {
      continue;
    }
    sent.add(key);
    out.push(body);
  }
  // 지난 결제일 표시는 지워 둡니다.
  const keep = [...sent].filter((k) => (k.split(':')[1] as DateStr) >= toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
  await setSetting(db, SENT_KEY, keep);
  return out;
}
