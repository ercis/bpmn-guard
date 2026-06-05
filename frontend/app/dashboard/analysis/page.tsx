
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye } from 'lucide-react';
import { ErrorAlert } from '@/components/error-alert';

import { ANALYSIS_STEPS, type AnalysisStatus, type RunningAnalysesResponse } from '@/types/schemas';
import { formatRelativeTime } from '@/lib/date';

const columnHelper = createColumnHelper<AnalysisStatus>();

const columns = [
  columnHelper.accessor('model_name', {
    header: 'Model',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('steps_status', {
    header: 'Running Steps',
    cell: (info) => {
      const stepsStatus = info.getValue();
      const runningSteps = ANALYSIS_STEPS.filter((s) => stepsStatus[s.id] === 'running');
      if (runningSteps.length === 0) return <span className="text-muted-foreground">Completed</span>;
      if (runningSteps.length === ANALYSIS_STEPS.length) return <span>All steps</span>;
      return <span>{runningSteps.length} steps</span>;
    },
  }),
  columnHelper.accessor('steps_completed', {
    header: 'Progress',
    cell: (info) => {
      const completed = info.getValue().length;
      const total = ANALYSIS_STEPS.length;
      const percent = (completed / total) * 100;
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={percent} className="h-2" />
          <span className="text-sm text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      );
    },
  }),
  columnHelper.accessor('created_at', {
    header: 'Started',
    cell: (info) => formatRelativeTime(info.getValue()),
  }),
  columnHelper.accessor('id', {
    header: 'Actions',
    cell: (info) => (
      <Button asChild size="sm" variant="outline">
        <Link href={`/dashboard/analysis/${info.getValue()}/status`}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Link>
      </Button>
    ),
  }),
];

export default function AnalysisPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['running-analyses'],
    queryFn: async () => {
      const res = await fetch('/api/analysis/running');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch analyses');
      return res.json() as Promise<RunningAnalysesResponse>;
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const table = useReactTable({
    data: data?.analyses ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="py-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Running Analyses</CardTitle>
            <CardDescription>
              {isLoading
                ? 'Loading analyses...'
                : data?.analyses.length === 0
                  ? 'No analyses currently running'
                  : `${data?.analyses.length} analysis${data?.analyses.length !== 1 ? 'es' : ''} in progress`
              }
            </CardDescription>
          </div>
          <Button asChild size="sm" className="hover:cursor-pointer">
            <Link href="/dashboard/analysis/new">
              <Plus className="h-4 w-4 mr-2" />
              New Analysis
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {error && !isLoading && (
            <ErrorAlert
              error={error instanceof Error ? error.message : 'Failed to load analyses'}
              onRetry={() => refetch()}
              isRetrying={isFetching}
              title="Error Loading Analyses"
            />
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && data?.analyses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No analyses currently running.</p>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && data && data.analyses.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
