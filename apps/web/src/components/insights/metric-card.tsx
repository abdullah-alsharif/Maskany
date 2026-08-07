'use client';

import { type LucideIcon } from 'lucide-react';

export function MetricCard({
  icon: Icon,
  value,
  label,
  sublabel,
  delay,
  color = 'terracotta',
  testId,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string;
  delay: string;
  color?: 'terracotta' | 'olive' | 'stone' | 'amber';
  testId?: string;
}) {
  const colorMap: Record<string, string> = {
    terracotta: 'bg-terracotta-50 text-terracotta-600',
    olive: 'bg-olive-50 text-olive-600',
    stone: 'bg-stone-100 text-stone-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div
      data-testid={testId}
      className={`flex flex-col gap-1.5 rounded-2xl bg-white border border-stone-200 p-4 animate-slide-up ${delay}`}
    >
      <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <span className="text-lg font-bold text-stone-950">{value}</span>
      <span className="text-xs text-stone-500">{label}</span>
      {sublabel && <span className="text-[11px] text-stone-400">{sublabel}</span>}
    </div>
  );
}
