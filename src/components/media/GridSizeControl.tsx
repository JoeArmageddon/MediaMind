'use client';

import { Minus, Plus } from 'lucide-react';
import { useMediaStore } from '@/store/mediaStore';

/** Compact +/- stepper for grid column density (1-6), backed by mediaStore's gridSize/setGridSize. */
export function GridSizeControl() {
  const gridSize = useMediaStore((s) => s.gridSize);
  const setGridSize = useMediaStore((s) => s.setGridSize);

  return (
    <div className="flex items-center h-14 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] px-1">
      <button
        onClick={() => setGridSize(gridSize - 1)}
        disabled={gridSize <= 1}
        className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--mm-text-60)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Fewer columns"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-mono text-[var(--mm-text-70)] tabular-nums">{gridSize}</span>
      <button
        onClick={() => setGridSize(gridSize + 1)}
        disabled={gridSize >= 6}
        className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--mm-text-60)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="More columns"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
