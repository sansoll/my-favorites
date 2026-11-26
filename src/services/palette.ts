import { extractColors, rgbToHex, sampleSize } from '../theme/color';

/** 사진에서 색을 뽑고(U9-2), 스포이드로 한 점의 색을 읽습니다. 캔버스가 필요해서 테스트에서는 바꿔 끼웁니다. */
export interface PhotoPalette {
  /** 화면에 보여 줄 사진 주소 */
  url: string;
  colors: string[];
  /** 사진의 가로·세로 비율 위치(0~1)에 있는 색 */
  pick(x: number, y: number): string;
  dispose(): void;
}

export type PaletteReader = (file: Blob) => Promise<PhotoPalette>;

const SPOID_SIZE = 320;

const canvasReader: PaletteReader = async (file) => {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const read = (size: number) => {
      const { w, h } = sampleSize(bmp.width, bmp.height, size);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bmp, 0, 0, w, h);
      return { w, h, data: ctx.getImageData(0, 0, w, h).data };
    };
    const small = read(64);
    const spoid = read(SPOID_SIZE);
    const url = URL.createObjectURL(file);
    return {
      url,
      colors: extractColors(small.data),
      pick(x, y) {
        const px = Math.min(spoid.w - 1, Math.max(0, Math.floor(x * spoid.w)));
        const py = Math.min(spoid.h - 1, Math.max(0, Math.floor(y * spoid.h)));
        const i = (py * spoid.w + px) * 4;
        return rgbToHex([spoid.data[i], spoid.data[i + 1], spoid.data[i + 2]]);
      },
      dispose: () => URL.revokeObjectURL(url),
    };
  } finally {
    bmp.close();
  }
};

let reader: PaletteReader = canvasReader;
export function readPalette(file: Blob): Promise<PhotoPalette> { return reader(file); }
export function setPaletteReader(r: PaletteReader | null): void { reader = r ?? canvasReader; }
