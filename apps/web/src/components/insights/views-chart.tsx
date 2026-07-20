'use client';

import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';

export function ViewsChart({ data }: { data: { date: string; views: number }[] }) {
  const { t } = useTranslation();

  if (data.length === 0) return null;

  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const barMaxHeight = 96;
  const totalViews = data.reduce((s, d) => s + d.views, 0);

  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4 animate-slide-up animate-stagger-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-700">{t('insights.viewsChart')}</h3>
        <span className="text-xs text-stone-400 flex items-center gap-1">
          <Eye size={13} strokeWidth={1.5} />
          {totalViews}
        </span>
      </div>
      <div className="relative overflow-x-auto -mx-4 px-4">
        <div className="flex items-end gap-[3px] h-24 min-w-max px-1" style={{ direction: 'ltr' }}>
          {data.map((d, i) => {
            const height = (d.views / maxViews) * barMaxHeight;
            return (
              <div
                key={d.date}
                className="w-11 flex flex-col items-center gap-1.5 group relative"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div
                  className="w-full rounded-[3px] bg-gradient-to-t from-terracotta-400 to-terracotta-500 opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:shadow-[0_2px_8px_rgba(226,104,61,0.3)] cursor-pointer"
                  style={{ height: `${Math.max(height, 3)}px` }}
                />
                <span className="text-[10px] text-stone-400 leading-tight w-11 text-center">
                  {d.date.slice(5)}
                </span>
                <div className="hidden group-hover:flex group-focus-within:flex absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 flex-col items-center pointer-events-none">
                  <div className="bg-stone-800 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap shadow-sm">
                    {d.views}
                  </div>
                  <div className="w-2 h-1.5 overflow-hidden -mt-px">
                    <div className="w-2 h-2 bg-stone-800 rotate-45 origin-center -translate-y-1/2" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {data.length >= 7 && (
          <div className="absolute start-4 end-4 bottom-6 border-t border-dashed border-stone-100 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
