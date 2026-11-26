import { useEffect, useRef } from 'react';

const COLORS = ['#FFD84D', '#FF8FB0', '#7CC4FF', '#8BE07A', '#B9B0FF', '#FF9F43', '#FFFFFF'];

/** 축하 효과: 양옆 아래에서 종이가 터져 오르고 떨어집니다. 움직임 줄이기 설정이면 그리지 않습니다. */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    const c = ref.current;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = c?.getContext?.('2d');
    if (!c || !ctx || reduce || typeof requestAnimationFrame !== 'function') return;
    const W = c.clientWidth || window.innerWidth, H = c.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5B4CDB';
    const R = Math.random;
    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; tilt: number; color: string; life: number; max: number };
    const ps: P[] = [];
    const spawn = (x: number, y: number, deg: number, spread: number, count: number, speed: number) => {
      for (let k = 0; k < count; k++) {
        const a = ((deg + (R() - 0.5) * spread) * Math.PI) / 180;
        const v = speed * (0.5 + R() * 0.7);
        ps.push({ x, y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, w: 6 + R() * 6, h: 9 + R() * 9, rot: R() * 6.3, vr: (R() - 0.5) * 0.25, tilt: R() * 6.3, color: [...COLORS, accent][Math.floor(R() * (COLORS.length + 1))], life: 0, max: 170 + R() * 110 });
      }
    };
    spawn(-10, H * 0.78, 64, 34, 80, 24);
    spawn(W + 10, H * 0.78, 116, 34, 80, 24);
    let frame = 0;
    let raf = 0;
    const step = () => {
      frame++;
      if (frame === 14) spawn(W / 2, H * 0.36, 90, 360, 60, 11);
      ctx.clearRect(0, 0, W, H);
      for (let k = ps.length - 1; k >= 0; k--) {
        const p = ps[k];
        p.vx *= 0.982; p.vy = Math.min(3.4, p.vy * 0.982 + 0.32);
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tilt += 0.1; p.life++;
        if (p.life > p.max || p.y > H + 40) { ps.splice(k, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life > p.max - 45 ? (p.max - p.life) / 45 : 1;
        ctx.fillStyle = p.color;
        ctx.scale(1, Math.cos(p.tilt));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (ps.length) raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} aria-hidden="true" data-confetti={fire || undefined} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }} />;
}
