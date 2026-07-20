'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, Home, MessageSquare, Plus, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MetricCard } from '../components/insights/metric-card';
import { PropertyLeaderboard } from '../components/insights/property-leaderboard';
import { ViewsChart } from '../components/insights/views-chart';
import { SkeletonCard } from '../components/ui/skeleton';
import { SeoHead } from '../components/seo-head';
import { useInsights } from '../hooks/use-insights';

function InsightsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function InsightsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useInsights();

  if (isPending) {
    return (
      <section className="page-content">
        <SeoHead title={t('meta.insights.title')} description={t('meta.insights.desc')} />
        <header className="px-4 pt-8 pb-3">
          <h1 className="font-display text-4xl text-stone-950 leading-tight">
            {t('insights.heading')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">{t('insights.subheading')}</p>
        </header>
        <InsightsSkeleton />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="page-content">
        <SeoHead title={t('meta.insights.title')} description={t('meta.insights.desc')} />
        <div className="flex flex-col items-center justify-center px-4 pt-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <Building2 size={28} className="text-red-400" strokeWidth={1.5} />
          </div>
          <p className="mt-4 text-sm text-stone-600 text-center">{t('insights.errorLoading')}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 min-h-[44px] px-6 rounded-xl bg-terracotta-500 text-white text-sm font-semibold hover:bg-terracotta-600 transition-colors"
          >
            {t('insights.retry')}
          </button>
        </div>
      </section>
    );
  }

  if (!data || data.stats.totalListings === 0) {
    return (
      <section className="page-content">
        <SeoHead title={t('meta.insights.title')} description={t('meta.insights.desc')} />
        <div className="flex flex-col items-center justify-center px-4 pt-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-terracotta-50 flex items-center justify-center">
            <Home size={28} className="text-terracotta-400" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 font-display text-xl text-stone-950">{t('insights.noProperties')}</h2>
          <button
            onClick={() => router.push('/properties/create')}
            className="mt-6 min-h-[44px] inline-flex items-center gap-2 px-6 rounded-xl bg-terracotta-500 text-white text-sm font-semibold hover:bg-terracotta-600 transition-colors"
          >
            <Plus size={18} />
            {t('insights.noPropertiesAction')}
          </button>
        </div>
      </section>
    );
  }

  const { stats, topProperties, viewsOverTime } = data;

  return (
    <section className="page-content">
      <SeoHead title={t('meta.insights.title')} description={t('meta.insights.desc')} />
      <header className="px-4 pt-8 pb-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-stone-950 leading-tight">
            {t('insights.heading')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">{t('insights.subheading')}</p>
        </div>
        <Link
          href="/properties/create"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-terracotta-500 text-white text-sm font-semibold shadow-sm hover:bg-terracotta-600 active:bg-terracotta-700 transition-colors active:scale-[0.96] shrink-0"
        >
          <Plus size={18} />
          {t('myProperties.newListing')}
        </Link>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <MetricCard
          icon={Building2}
          value={stats.totalListings}
          label={t('insights.totalListings')}
          delay="animate-stagger-1"
          color="terracotta"
        />
        <MetricCard
          icon={TrendingUp}
          value={stats.activeListings}
          label={t('insights.activeListings')}
          sublabel={t('insights.last30d')}
          delay="animate-stagger-2"
          color="olive"
        />
        <MetricCard
          icon={Eye}
          value={stats.totalViews30d}
          label={t('insights.totalViews')}
          sublabel={t('insights.last30d')}
          delay="animate-stagger-3"
          color="amber"
        />
        <MetricCard
          icon={MessageSquare}
          value={stats.totalInquiries30d}
          label={t('insights.totalInquiries')}
          sublabel={t('insights.last30d')}
          delay="animate-stagger-4"
          color="stone"
        />
      </div>

      {/* Views Over Time */}
      <div className="px-4">
        <ViewsChart data={viewsOverTime} />
      </div>

      {/* Top Properties */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-700">{t('insights.topProperties')}</h2>
          <p className="text-xs text-stone-400">{t('insights.topPropertiesDesc')}</p>
        </div>
        <PropertyLeaderboard properties={topProperties} />
      </div>
    </section>
  );
}
