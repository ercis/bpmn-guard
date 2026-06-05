'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, ArrowLeft, Loader2, XCircle } from 'lucide-react';
import { ErrorAlert } from '@/components/error-alert';

import { AnalysisStepList } from '../../_components/analysis-step-list';
import { ANALYSIS_STEPS, type AnalysisStatus, type AnalysisStatusValue } from '@/types/schemas';

function StatusIndicator({ status }: { status: AnalysisStatusValue }) {
  if (status === 'running') {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Running
          </Badge>
          <p className="text-sm text-muted-foreground mt-1">Analysis in progress...</p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
        <div>
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            Completed
          </Badge>
          <p className="text-sm text-muted-foreground mt-1">Redirecting to report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <XCircle className="h-8 w-8 text-red-500" />
      <div>
        <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">
          Failed
        </Badge>
        <p className="text-sm text-muted-foreground mt-1">Analysis encountered an error</p>
      </div>
    </div>
  );
}

export default function AnalysisStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: analysis, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analysis-status', id],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/${id}/status`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch analysis status');
      return res.json() as Promise<AnalysisStatus>;
    },
    refetchInterval: (query) => {
      // Stop polling when analysis is no longer running
      if (query.state.data?.status !== 'running') return false;
      return 3000;
    },
    refetchIntervalInBackground: true,
  });

  // Auto-redirect to report when complete
  useEffect(() => {
    if (analysis?.status === 'completed' && analysis.report_id) {
      // Invalidate reports cache so the list refreshes with the new report
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      router.push(`/dashboard/reports/${analysis.report_id}`);
    }
  }, [analysis, router, queryClient]);

  if (isLoading) {
    return (
      <div className="py-6 w-full">
        <div className="mb-4">
          <Link href="/dashboard/analysis">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to Analyses
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <Skeleton className="h-7 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-32 mt-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="py-6 w-full">
        <div className="mb-4">
          <Link href="/dashboard/analysis">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to Analyses
            </Button>
          </Link>
        </div>
        <ErrorAlert
          error={error instanceof Error ? error.message : 'Analysis not found'}
          onRetry={() => refetch()}
          isRetrying={isFetching}
          title="Error Loading Analysis"
        />
      </div>
    );
  }

  const progressPercent = (analysis.steps_completed.length / ANALYSIS_STEPS.length) * 100;

  return (
    <div className="py-6 w-full">
      <div className="mb-4">
        <Link href="/dashboard/analysis">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to Analyses
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">{analysis.model_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              File: {analysis.model_name}.bpmn
            </p>
          </div>
          <StatusIndicator status={analysis.status} />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>
                {analysis.steps_completed.length} / {ANALYSIS_STEPS.length}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Error message if failed */}
          {analysis.status === 'failed' && analysis.error && (
            <div className="flex items-start gap-2 text-red-600 p-4 bg-red-50 rounded-md border border-red-200">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Analysis failed</p>
                <p className="text-sm mt-1">{analysis.error}</p>
              </div>
            </div>
          )}

          {/* Step checklist */}
          <AnalysisStepList
            stepsStatus={analysis.steps_status}
            status={analysis.status}
          />

          {/* View report button (shown when complete) */}
          {analysis.status === 'completed' && analysis.report_id && (
            <Button asChild className="w-full">
              <Link href={`/dashboard/reports/${analysis.report_id}`}>View Report</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
