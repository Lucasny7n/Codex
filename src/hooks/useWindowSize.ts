import { useEffect, useState } from 'react';

export type WindowSizeKind = 'narrow' | 'compact' | 'wide' | 'ultrawide';

export interface WindowSizeSnapshot {
  width: number;
  height: number;
  kind: WindowSizeKind;
  isSquareish: boolean;
}

function resolveKind(width: number): WindowSizeKind {
  if (width < 760) return 'narrow';
  if (width < 1180) return 'compact';
  if (width >= 1800) return 'ultrawide';
  return 'wide';
}

function snapshot(): WindowSizeSnapshot {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      height: 900,
      kind: 'wide',
      isSquareish: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = height > 0 ? width / height : 1;

  return {
    width,
    height,
    kind: resolveKind(width),
    isSquareish: ratio > 0.82 && ratio < 1.18,
  };
}

export function useWindowSize(): WindowSizeSnapshot {
  const [size, setSize] = useState<WindowSizeSnapshot>(() => snapshot());

  useEffect(() => {
    function handleResize(): void {
      setSize(snapshot());
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
