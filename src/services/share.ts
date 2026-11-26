/** 결산 카드를 이미지로 그려 폰 공유 창으로 보냅니다(U10-3). 공유를 못 하면 내려받기. 테스트에서는 바꿔 끼웁니다. */
export interface ShareCard { title: string; kicker: string; big: string; after: string; lines: string[]; color: string }
export type CardSharer = (card: ShareCard, fileName: string) => Promise<'shared' | 'saved' | 'cancelled'>;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch;
    }
    out.push(line);
  }
  return out;
}

/** 새로 그리므로 사진·위치 정보 같은 부가 정보가 들어가지 않습니다. */
export async function drawCard(card: ShareCard): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, card.color);
  g.addColorStop(1, '#14141A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFFFFF';
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  ctx.font = `500 44px ${font}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(card.title, 90, 140);
  ctx.globalAlpha = 1;
  ctx.font = `500 54px ${font}`;
  let y = 400;
  for (const l of wrap(ctx, card.kicker, 900)) { ctx.fillText(l, 90, y); y += 72; }
  ctx.font = `700 120px ${font}`;
  y += 70;
  for (const l of wrap(ctx, card.big, 900)) { ctx.fillText(l, 90, y); y += 140; }
  ctx.font = `500 54px ${font}`;
  for (const l of wrap(ctx, card.after, 900)) { ctx.fillText(l, 90, y); y += 72; }
  ctx.font = `400 44px ${font}`;
  ctx.globalAlpha = 0.85;
  y += 60;
  for (const l of card.lines) { ctx.fillText(l, 90, y); y += 64; }
  ctx.globalAlpha = 0.6;
  ctx.font = `500 36px ${font}`;
  ctx.fillText('내가 좋아하는 것들', 90, H - 90);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
}

const defaultSharer: CardSharer = async (card, fileName) => {
  const blob = await drawCard(card);
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: card.title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
};

let sharer: CardSharer = defaultSharer;
export function shareCard(card: ShareCard, fileName: string) { return sharer(card, fileName); }
export function setCardSharer(s: CardSharer | null): void { sharer = s ?? defaultSharer; }
