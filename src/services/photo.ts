/** 사진은 긴 변 900px로 줄여 저장합니다(DESIGN). 캔버스로 다시 그려서 촬영 위치(GPS) 같은 부가 정보는 모두 빠집니다. */
export const PHOTO_MAX = 900;

export function fitWithin(w: number, h: number, max = PHOTO_MAX): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function resizePhoto(file: Blob, max = PHOTO_MAX): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decode(file);
  try {
    const { w, h } = fitWithin(img.w, img.h, max);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img.src, 0, 0, w, h);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
    return { blob, width: w, height: h };
  } finally {
    img.close?.();
  }
}
