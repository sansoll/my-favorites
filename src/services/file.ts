/** 글자를 파일로 내려받게 합니다(안드로이드 크롬은 `다운로드` 폴더에 저장). */
export type FileSaver = (name: string, text: string, type?: string) => void;

export const downloadText: FileSaver = (name, text, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

let saver: FileSaver = downloadText;
export function saveTextFile(name: string, text: string, type?: string): void { saver(name, text, type); }
/** 테스트에서 바꿔 끼웁니다. */
export function setFileSaver(s: FileSaver | null): void { saver = s ?? downloadText; }
