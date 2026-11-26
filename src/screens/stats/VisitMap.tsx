import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import s from './Visited.module.css';

export interface MapPoint { id: string; lat: number; lng: number; count: number; label: string; rank: number }

export interface VisitMapProps {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 핀 크기: 많이 간 곳일수록 크게(28~48px). */
export function pinSize(count: number, max: number): number {
  if (max <= 1) return 32;
  return Math.round(28 + (20 * Math.log(count)) / Math.log(max));
}

/** 다녀온 곳 지도(OpenStreetMap). 많이 간 곳일수록 핀이 크고 횟수가 적혀 있어요. */
export default function VisitMap({ points, selectedId, onSelect }: VisitMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const pick = useRef(onSelect);
  pick.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { worldCopyJump: true, zoomControl: true, attributionControl: true, minZoom: 1 });
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> 기여자',
    }).addTo(m);
    m.setView([30, 127], 1);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // 점이 바뀌면 다시 찍고 모두 보이게 맞춤
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const max = Math.max(1, ...points.map((p) => p.count));
    for (const p of [...points].sort((a, b) => a.count - b.count)) {
      const size = pinSize(p.count, max);
      const icon = L.divIcon({
        className: s.pinWrap,
        html: `<span class="${s.pin}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${p.count}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const mk = L.marker([p.lat, p.lng], { icon, title: `${p.label} ${p.count}번`, keyboard: true, riseOnHover: true })
        .bindTooltip(`${p.rank}. ${esc(p.label)} · ${p.count}번`, { direction: 'top', offset: [0, -size / 2] })
        .on('click', () => pick.current(p.id))
        .addTo(g);
      markers.current.set(p.id, mk);
    }
    try {
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 14);
      else if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 });
    } catch { /* 지도 크기를 아직 모를 때 */ }
  }, [points]);

  // 목록에서 고른 곳으로 이동
  useEffect(() => {
    const m = map.current;
    const mk = selectedId ? markers.current.get(selectedId) : undefined;
    if (!m || !mk) return;
    try {
      m.setView(mk.getLatLng(), Math.max(m.getZoom() || 0, 13), { animate: true });
      mk.openTooltip();
    } catch { /* 지도 크기가 아직 없을 때(숨겨진 상태 등)는 이동만 건너뜀 */ }
  }, [selectedId]);

  return <div ref={el} className={s.map} role="region" aria-label="다녀온 곳 지도" />;
}
