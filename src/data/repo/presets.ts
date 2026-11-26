import { BASE_PRESETS } from '../../domain/presets';
import { sameName } from '../../domain/name';
import { newId, type FavoritesDB } from '../db';
import { getSetting, setSetting } from '../settings';
import type { Preset } from '../types';

export async function listPresets(db: FavoritesDB): Promise<Preset[]> {
  return db.presets.orderBy('order').toArray();
}

/** 고른 기본 프리셋만 만듭니다. 같은 이름(공백 무시)의 프리셋이 이미 있으면 건너뜁니다. 만든 이름을 돌려줍니다. */
export async function createBasePresets(db: FavoritesDB, names: string[]): Promise<string[]> {
  return db.transaction('rw', db.presets, async () => {
    const all = await db.presets.toArray();
    let order = all.reduce((m, p) => Math.max(m, p.order), 0);
    const made: string[] = [];
    for (const name of names) {
      const base = BASE_PRESETS.find((b) => b.name === name);
      if (!base || all.some((p) => sameName(p.name, name))) continue;
      const p: Preset = { id: newId(), name: base.name, items: structuredClone(base.items), order: ++order };
      await db.presets.add(p);
      all.push(p);
      made.push(name);
    }
    return made;
  });
}

const ASKED = 'basePresetAsked';

/** 기본 프리셋 창은 한 번만 자동으로 묻습니다. */
export async function shouldAskBasePresets(db: FavoritesDB): Promise<boolean> {
  return !(await getSetting(db, ASKED, false));
}

export async function markBasePresetsAsked(db: FavoritesDB): Promise<void> {
  await setSetting(db, ASKED, true);
}
