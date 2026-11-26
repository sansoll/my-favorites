import { usePhoto } from '../hooks/usePhoto';
import s from './TargetPhoto.module.css';

/** 대상 사진(U9-6): 분류·세부·응원법 화면 위쪽 띠. 사진이 없으면 아무것도 그리지 않습니다. */
export function TargetBanner({ photoId, name }: { photoId?: string; name: string }) {
  const photo = usePhoto(photoId);
  if (!photo) return null;
  return <div className={s.banner} style={{ backgroundImage: `url("${photo.url}")` }} role="img" aria-label={`${name} 사진`} />;
}

/** 내역 아이콘: 사진이 있으면 동그란 사진, 없으면 대상 색 점 */
export function TargetIcon({ photoId, color, className }: { photoId?: string; color?: string; className?: string }) {
  const photo = usePhoto(photoId);
  if (!photo) return <span className={className} style={{ background: color }} aria-hidden="true" />;
  return <span className={s.icon} style={{ backgroundImage: `url("${photo.url}")`, borderColor: color }} aria-hidden="true" data-photo="" />;
}
