import React from 'react';

interface VehiclePlateBadgeProps {
  plate?: string;
}

export const VehiclePlateBadge: React.FC<VehiclePlateBadgeProps> = ({plate}) => {
  const clean = plate?.trim();
  if (!clean) {
    return <span className="font-mono text-xs text-slate-400 dark:text-slate-500">—</span>;
  }

  return (
    <span className="inline-flex items-center overflow-hidden rounded border border-[#034EA2]/50 bg-white font-mono text-[11px] font-bold tracking-wide text-[#0B2C5D] shadow-2xs whitespace-nowrap dark:border-sky-500/40 dark:bg-slate-950 dark:text-sky-300">
      <span className="bg-[#0B2C5D] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 dark:bg-sky-900 dark:text-amber-300">
        ET
      </span>
      <span className="px-2 py-0.5 tabular-nums">{clean}</span>
    </span>
  );
};
