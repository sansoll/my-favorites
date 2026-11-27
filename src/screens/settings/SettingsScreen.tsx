import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDb } from '../../data/db';
import { listPresets } from '../../data/repo/presets';
import { listRecurrings } from '../../data/repo/recurring';
import { BackupError, exportFileName, exportText, importData, lastExportAt, readBackupFile, wipeAll, type BackupFile } from '../../data/backup';
import { saveTextFile } from '../../services/file';
import { activeTheme } from '../../data/repo/theme';
import { getSetting, setSetting } from '../../data/settings';
import { CHEER_COLOR_KEY, CHEER_COLORS, DEFAULT_CHEER_COLOR } from '../../domain/cheer';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import u from '../../components/ui.module.css';
import s from './Settings.module.css';

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 설정(U7-5). 테마(M9)와 튜토리얼(M10)은 각 단계에서 더합니다. */
export function SettingsScreen() {
  const toast = useToast();
  const navigate = useNavigate();
  const presets = useLiveQuery(() => listPresets(getDb()), []) ?? [];
  const recurrings = useLiveQuery(() => listRecurrings(getDb()), []) ?? [];
  const lastExport = useLiveQuery(() => lastExportAt(getDb()), []);
  const themeName = useLiveQuery(async () => (await activeTheme(getDb())).name, []) ?? '';
  const cheerColor = useLiveQuery(() => getSetting<string>(getDb(), CHEER_COLOR_KEY, DEFAULT_CHEER_COLOR), []) ?? DEFAULT_CHEER_COLOR;
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<'export' | 'info' | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [wipe, setWipe] = useState(false);

  const doExport = async () => {
    const now = new Date();
    saveTextFile(exportFileName(now), await exportText(getDb(), now));
    setSheet(null);
    toast('내보냈어요. 다운로드 폴더를 확인해 주세요');
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await readBackupFile(file));
      setImportErr(null);
    } catch (err) {
      setImportErr(err instanceof BackupError ? err.message : '파일을 읽을 수 없어요.');
    }
  };

  const doImport = async () => {
    if (!pending) return;
    const backup = pending;
    setPending(null);
    try {
      await importData(getDb(), backup);
      toast(`불러왔어요. 기록 ${backup.data.records.length}건`);
    } catch {
      setImportErr('불러오지 못했어요. 지금 데이터는 그대로예요.');
    }
  };

  const doWipe = async () => {
    setWipe(false);
    await wipeAll(getDb());
    toast('모든 데이터를 지웠어요');
    navigate('/');
  };

  return (
    <Screen title="설정">
      <section className={s.group}>
        <h2 className={s.groupTitle}>목록과 꾸미기</h2>
        <Link to="/settings/presets" className={s.row}><span>프리셋</span><span className={s.meta}>{presets.length ? presets.map((p) => p.name).join(' · ') : '없음'} ›</span></Link>
        <Link to="/settings/theme" className={s.row}><span>테마와 꾸미기</span><span className={s.meta}>{themeName} ›</span></Link>
        <Link to="/settings/recurring" className={s.row}><span>정기 결제</span><span className={s.meta}>{recurrings.length ? `${recurrings.filter((x) => x.enabled).length}개 켜짐` : '없음'} ›</span></Link>
        <Link to="/tutorial" className={s.row}><span>튜토리얼 다시 보기</span><span className={s.meta}>›</span></Link>
      </section>

      <section className={s.group}>
        <h2 className={s.groupTitle}>응원법</h2>
        <div className={s.row}>
          <span>칠하는 색</span>
          <span className={s.swatches} role="radiogroup" aria-label="응원법 칠하는 색">
            {CHEER_COLORS.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={cheerColor === c.color} aria-label={c.name} className={`${s.swatch} ${cheerColor === c.color ? s.swatchOn : ''}`} style={{ background: c.color }} onClick={() => void setSetting(getDb(), CHEER_COLOR_KEY, c.color)} />
            ))}
          </span>
        </div>
      </section>

      <section className={s.group}>
        <h2 className={s.groupTitle}>데이터</h2>
        <button type="button" className={s.row} onClick={() => setSheet('export')}>
          <span>내보내기 (JSON)</span><span className={s.meta}>{lastExport ? `마지막 ${formatDateTime(lastExport)}` : '아직 안 함'} ›</span>
        </button>
        <button type="button" className={s.row} onClick={() => fileRef.current?.click()}>
          <span>불러오기</span><span className={s.meta}>파일 고르기 ›</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className={s.hidden} aria-label="불러올 파일" tabIndex={-1} onChange={(e) => void pickFile(e)} />
        {importErr && <p className={u.error} role="alert">{importErr}</p>}
        <button type="button" className={`${s.row} ${s.danger}`} onClick={() => setWipe(true)}>
          <span>모든 데이터 지우기</span><span className={s.meta}>›</span>
        </button>
        <div className={`${s.row} ${s.off}`} aria-disabled="true">
          <span>구글 계정 연동</span><span className={s.meta}>2단계</span>
        </div>
      </section>

      <section className={s.group}>
        <h2 className={s.groupTitle}>정보</h2>
        <button type="button" className={s.row} onClick={() => setSheet('info')}>
          <span>앱 정보</span><span className={s.meta}>{__APP_VERSION__} ›</span>
        </button>
      </section>

      <Sheet open={sheet === 'export'} onClose={() => setSheet(null)} title="내보내기">
        <p className={s.text}>기록, 목록, 정기 결제, 체크 달력, 장소, 응원법, 테마, 설정을 JSON 파일 하나로 저장해요.</p>
        <p className={s.small}>사진(대상 사진·달력 표지)과 글꼴 파일은 넣지 않아요. 파일은 이 폰의 다운로드 폴더에 저장돼요.</p>
        <button type="button" className={u.primary} onClick={() => void doExport()}>파일로 저장</button>
      </Sheet>

      <Sheet open={sheet === 'info'} onClose={() => setSheet(null)} title="앱 정보">
        <dl className={s.info}>
          <dt>이름</dt><dd>내가 좋아하는 것들</dd>
          <dt>버전</dt><dd>{__APP_VERSION__}{__PREVIEW__ ? ' (미리보기)' : ''}</dd>
        </dl>
        <p className={s.small}>모든 데이터는 이 폰 안에만 저장돼요. 계정도 서버도 없어요.</p>
        <p className={s.small}>장소를 찾을 때만 검색어가 카카오(국내)나 OpenStreetMap(해외)으로 보내져요.</p>
        <p className={s.small}>장소 검색: 카카오 / © OpenStreetMap 기여자</p>
      </Sheet>

      <ConfirmDialog
        open={pending !== null}
        title="지금 데이터를 덮어쓸까요?"
        body={`지금 폰에 있는 기록은 모두 바뀌어요. 파일의 기록 ${pending?.data.records.length ?? 0}건을 불러와요.`}
        confirmLabel="덮어쓰기"
        onConfirm={() => void doImport()}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={wipe}
        title="모든 데이터를 지울까요?"
        body="기록, 목록, 체크 달력, 응원법, 테마가 모두 지워지고 처음 상태가 돼요. 내보낸 파일이 없으면 되돌릴 수 없어요."
        confirmLabel="모두 지우기"
        onConfirm={() => void doWipe()}
        onCancel={() => setWipe(false)}
      />
    </Screen>
  );
}
