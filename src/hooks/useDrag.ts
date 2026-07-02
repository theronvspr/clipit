import { useCallback } from 'react';

export interface UseDragOptions {
  onDrag: (pct: number) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export const useDrag = () => {
  const startDrag = useCallback((
    e: React.PointerEvent<HTMLElement>,
    options: UseDragOptions
  ) => {
    const container = options.containerRef.current;
    if (!container) return;

    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const updatePosition = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      options.onDrag(Math.max(0, Math.min(100, pct)));
    };

    // Trigger initial update on down
    updatePosition(e.clientX);

    const handlePointerMove = (ev: PointerEvent) => {
      updatePosition(ev.clientX);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // Safe check in case pointer capture is already lost
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, []);

  return { startDrag };
};
