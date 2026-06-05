'use client';

import { useQuery } from '@tanstack/react-query';
import { useViewMode } from '@/hooks/use-view-mode';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/error-alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Layers, AlertTriangle, Copy, RefreshCw, Users, User } from 'lucide-react';
import Link from 'next/link';
import type { KPIResponse, ViewMode } from '@/types/schemas';

import { KPICard, KPICardSkeleton } from './_components/kpi-card';
import { ViolationChart, ViolationChartSkeleton } from './_components/violation-chart';
import { QualityTrendChart, QualityTrendChartSkeleton } from './_components/quality-trend-chart';
import {
  RatingDistributionChart,
  RatingDistributionChartSkeleton,
} from './_components/rating-distribution-chart';
import { ComplexityChart, ComplexityChartSkeleton } from './_components/complexity-chart';
import { RecentReportsTable, RecentReportsTableSkeleton } from './_components/recent-reports-table';
import { LearningSuggestions } from './_components/learning-suggestions';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useViewMode();

  // Fetch both datasets in parallel
  const {
    data: allKpiData,
    isLoading: isLoadingAll,
    error: allQueryError,
    refetch: refetchAll,
    isFetching: isFetchingAll,
  } = useQuery({
    queryKey: ['kpis', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/kpis');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch KPIs');
      return res.json() as Promise<KPIResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: myKpiData,
    isLoading: isLoadingMy,
    error: myQueryError,
    refetch: refetchMy,
    isFetching: isFetchingMy,
  } = useQuery({
    queryKey: ['kpis', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/kpis/me');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch personal KPIs');
      return res.json() as Promise<KPIResponse>;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (longer due to LLM call for learning suggestions)
  });

  // Select data based on current view mode
  const kpiData = viewMode === 'all' ? allKpiData : myKpiData;
  const isLoading = viewMode === 'all' ? isLoadingAll : isLoadingMy;
  const isFetching = viewMode === 'all' ? isFetchingAll : isFetchingMy;
  const queryError = viewMode === 'all' ? allQueryError : myQueryError;
  const refetch = viewMode === 'all' ? refetchAll : refetchMy;

  const error = queryError ? (queryError as Error).message : null;

  return (
    <div className="space-y-4 md:space-y-6 py-4 md:py-8">
      {/* Header - Always visible */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">BPMN Guard Overview</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isLoading
              ? 'Loading metrics...'
              : !kpiData || kpiData.total_reports === 0
                ? 'No evaluations found'
                : `${viewMode === 'me' ? 'Your personal metrics from ' : 'Aggregated metrics from '}${kpiData.total_reports} evaluation${kpiData.total_reports !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v: string) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Users className="h-4 w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="me" className="gap-2">
                <User className="h-4 w-4" />
                Me
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching || isLoading} size="sm" className="sm:size-default">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild size="sm" className="sm:size-default">
            <Link href="/dashboard/analysis/new">New Analysis</Link>
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <DashboardSkeleton />}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorAlert error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      )}

      {/* Empty State */}
      {!isLoading && !error && (!kpiData || kpiData.total_reports === 0) && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
          <div className="text-center">
            <Activity className="text-muted-foreground mx-auto h-12 w-12 sm:h-16 sm:w-16" />
            <h2 className="mt-4 text-xl sm:text-2xl font-semibold">
              {viewMode === 'me' ? 'No Personal Reports Yet' : 'No Reports Yet'}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm sm:text-base">
              {viewMode === 'me'
                ? "You haven't uploaded any BPMN models yet. Upload a model and run an analysis to see your personal metrics."
                : 'Start by running an analysis on your BPMN models to see aggregated metrics and insights here.'}
            </p>
            <Button asChild className="mt-6">
              <Link href="/dashboard/analysis/new">Run Your First Analysis</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content - Only when data is loaded */}
      {!isLoading && !error && kpiData && kpiData.total_reports > 0 && (
        <>
          {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Avg Model Health"
          value={kpiData.avg_evaluation_rating !== null ? `${kpiData.avg_evaluation_rating}/10` : 'N/A'}
          subtitle="Average evaluation rating"
          icon={Activity}
        />
        <KPICard
          title="Structural Complexity"
          value={kpiData.complexity_level}
          subtitle={
            kpiData.avg_cfc_score !== null ? `CFC: ${kpiData.avg_cfc_score.toFixed(1)}` : 'No data'
          }
          icon={Layers}
        />
        <KPICard
          title="Common Violations"
          value={kpiData.most_common_violation}
          subtitle="Most frequent issue type"
          icon={AlertTriangle}
        />
        <KPICard
          title="Duplicate Risk"
          value={`${kpiData.duplicate_risk_percentage.toFixed(0)}%`}
          subtitle="Models with >90% similarity"
          icon={Copy}
        />
      </div>

      {/* Learning Suggestions - Only shown in "Me" view */}
      {viewMode === 'me' && kpiData.learning_suggestions && (
        <LearningSuggestions suggestions={kpiData.learning_suggestions} />
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-7">
        <ViolationChart data={kpiData.violation_distribution} />
        <QualityTrendChart data={kpiData.report_trends} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-7">
        <RatingDistributionChart data={kpiData.rating_distribution} />
        <ComplexityChart data={kpiData.complexity_metrics} />
      </div>

      {/* Recent Reports Table */}
      <RecentReportsTable data={kpiData.recent_reports} />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      {/* KPI Cards Skeleton */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>

      {/* Charts Row 1 Skeleton */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-7">
        <ViolationChartSkeleton />
        <QualityTrendChartSkeleton />
      </div>

      {/* Charts Row 2 Skeleton */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-7">
        <RatingDistributionChartSkeleton />
        <ComplexityChartSkeleton />
      </div>

      {/* Recent Reports Skeleton */}
      <RecentReportsTableSkeleton />
    </>
  );
}
