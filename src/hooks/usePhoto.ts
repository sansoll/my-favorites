import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDb } from '../data/db';

export interface PhotoView { url: string; w: number; h: number }

/** 저장한 사진을 화면에 쓸 주소로 바꿉니다. 화면을 떠나면 주소를 풀어 줍니다. */
export function usePhoto(id: string | null | undefined): PhotoView | null {
  const blob = useLiveQuery(async () => (id ? (await getDb().blobs.get(id)) ?? null : null), [id]);
  const [view, setView] = useState<PhotoView | null>(null);
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') { setView(null); return; }
    let url: string;
    try {
      url = URL.createObjectURL(blob.data);
    } catch {
      setView(null); // 읽을 수 없는 사진은 없는 것처럼 둡니다.
      return;
    }
    setView({ url, w: blob.width ?? 0, h: blob.height ?? 0 });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return view;
}
