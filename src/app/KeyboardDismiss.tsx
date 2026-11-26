import { useEffect } from 'react';

const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]):not([type=color]), textarea, select, [contenteditable=""], [contenteditable="true"]';

/** 글자 입력칸 말고 다른 곳을 누르면 입력을 끝내 키보드를 내립니다(휴대폰 피드백). */
export function shouldDismiss(target: EventTarget | null, active: Element | null): boolean {
  if (!(active instanceof HTMLElement) || !active.matches(TYPING)) return false;
  if (!(target instanceof Element)) return true;
  if (target.closest(TYPING)) return false;
  // 입력칸에 붙은 라벨을 누르면 그 칸으로 다시 가므로 그대로 둡니다.
  const label = target.closest('label');
  if (label && label.querySelector(TYPING)) return false;
  return true;
}

export function KeyboardDismiss() {
  useEffect(() => {
    // 손을 뗄 때(pointerup) 내립니다. 아이폰은 빈 곳을 누르면 click이 문서까지 오지 않아서 click 대신 씁니다.
    // 누른 버튼의 click은 그대로 이어서 일어납니다.
    const onUp = (e: PointerEvent) => {
      const active = document.activeElement;
      if (shouldDismiss(e.target, active)) (active as HTMLElement).blur();
    };
    document.addEventListener('pointerup', onUp);
    return () => document.removeEventListener('pointerup', onUp);
  }, []);
  return null;
}
