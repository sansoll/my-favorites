import s from './Switch.module.css';

/** 켜기/끄기 스위치. 이름은 label로 읽힙니다. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`${s.sw} ${checked ? s.on : ''}`} onClick={() => onChange(!checked)}>
      <span className={s.knob} aria-hidden="true" />
    </button>
  );
}
