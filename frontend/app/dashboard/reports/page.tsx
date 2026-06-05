'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useViewMode } from '@/hooks/use-view-mode';
import { usePageSize, type PageSize } from '@/hooks/use-page-size';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, Loader2, FileText, Users, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorAlert } from '@/components/error-alert';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState
} from '@tanstack/react-table';
import type { EvaluationReportsResponse, EvaluationReport, ViewMode } from '@/types/schemas';
import { formatDateShort } from '@/lib/date';

function getRatingColor(rating: number | null): 'success' | 'secondary' | 'destructive' {
  if (rating === null) return 'secondary';
  if (rating >= 8) return 'success';
  if (rating >= 5) return 'secondary';
  return 'destructive';
}

function getFileName(filePath: string): string {
  // Extract filename from path like "models/20260118_102826_8da5c744_Hotel.bpmn"
  const fullName = filePath.split('/').pop() || filePath;
  // Remove timestamp and UUID prefix: "20260118_102826_8da5c744_Hotel.bpmn" -> "Hotel.bpmn"
  const match = fullName.match(/^\d{8}_\d{6}_[a-f0-9]{8}_(.+)$/);
  const fileName = match ? match[1] : fullName;
  // Remove .bpmn extension
  return fileName.replace(/\.bpmn$/i, '');
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode();
  const [pageSize, setPageSize] = usePageSize();
  const [page, setPage] = useState(1);

  // Map frontend column IDs to backend sort field names
  const columnToBackendField: Record<string, string> = {
    file_name: 'file_name',
    rating: 'evaluation_rating',
    created_at: 'created_at',
  };
  const sortBy = columnToBackendField[sorting[0]?.id] ?? 'created_at';
  const sortDirection = sorting[0]?.desc === false ? 'asc' : 'desc';

  const {
    data: reportsData = { total: 0, items: [] },
    isLoading: loading,
    error: queryError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['reports', { page, pageSize, viewMode, sortBy, sortDirection }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        view: viewMode,
        sort_by: sortBy,
        sort_direction: sortDirection,
      });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch reports');
      return res.json() as Promise<EvaluationReportsResponse>;
    },
    placeholderData: keepPreviousData,
  });

  const error = queryError ? (queryError as Error).message : null;

  const totalPages = Math.ceil(reportsData.total / pageSize);

  // Clamp page when total shrinks (e.g. after deleting items)
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const handleViewModeChange = (v: ViewMode) => {
    setViewMode(v);
    setPage(1);
    setRowSelection({});
  };

  const handlePageSizeChange = (v: PageSize) => {
    if (v === pageSize) return;
    setPageSize(v);
    setPage(1);
    setRowSelection({});
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete reports in parallel using Promise.allSettled
      const deletePromises = ids.map(async (id) => {
        const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || errorData.error || 'Unknown error');
        }
        return id;
      });

      const results = await Promise.allSettled(deletePromises);

      const errors: Array<{ id: string; name?: string; error: string }> = [];
      const successfulDeletes: string[] = [];

      results.forEach((result, idx) => {
        const id = ids[idx];
        if (result.status === 'rejected') {
          const reportName = reportsData.items.find(r => r.id === id)?.file_path;
          errors.push({
            id,
            name: reportName ? getFileName(reportName) : undefined,
            error: result.reason instanceof Error ? result.reason.message : 'Network error'
          });
        } else {
          successfulDeletes.push(id);
        }
      });

      return { errors, successfulDeletes, isSingleDelete: ids.length === 1 };
    },
    onMutate: async (ids) => {
      setDeletingIds(new Set(ids));
    },
    onSuccess: (data) => {
      const { errors, successfulDeletes, isSingleDelete } = data;

      // Handle results
      if (errors.length === 0) {
        // All successful
        if (isSingleDelete) {
          toast.success('Report deleted successfully');
        } else {
          toast.success(`Successfully deleted ${successfulDeletes.length} report${successfulDeletes.length > 1 ? 's' : ''}`);
        }
        setRowSelection({});
      } else if (successfulDeletes.length === 0) {
        // All failed
        if (isSingleDelete) {
          toast.error(`Failed to delete report: ${errors[0].error}`);
        } else {
          toast.error(`Failed to delete ${errors.length} report${errors.length > 1 ? 's' : ''}`);
        }
      } else {
        // Partial success
        toast.warning(
          `Deleted ${successfulDeletes.length} of ${successfulDeletes.length + errors.length} reports. ${errors.length} failed.`,
          {
            description: errors.map(e => e.name || e.id).join(', ')
          }
        );
        // Only clear selection for successful deletes
        const remainingSelection = Object.keys(rowSelection).reduce((acc, rowId) => {
          if (!successfulDeletes.includes(rowId)) {
            acc[rowId] = true;
          }
          return acc;
        }, {} as Record<string, boolean>);
        setRowSelection(remainingSelection);
      }

      // Invalidate and refetch reports list
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete reports');
    },
    onSettled: () => {
      setDeletingIds(new Set());
    },
  });



  const columns: ColumnDef<EvaluationReport>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="h-5 w-5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="h-5 w-5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'file_name',
      accessorFn: (row) => row.file_name ?? getFileName(row.file_path),
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            File Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => <span className="font-medium">{row.getValue('file_name')}</span>,
    },
    {
      id: 'rating',
      accessorFn: (row) => row.model_evaluation?.evaluation_rating ?? null,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Overall Rating
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        const rating = row.original.model_evaluation?.evaluation_rating ?? null;
        return (
          <Badge variant={getRatingColor(rating)}>
            {rating !== null ? `${rating}/10` : 'N/A'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Created
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateShort(row.getValue('created_at'))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const report = row.original;
        const isDeleting = deletingIds.has(report.id);
        const isAnyDeleting = deletingIds.size > 0;

        return (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/reports/${report.id}`}>
                <FileText className="h-4 w-4 mr-1" />
                Report
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isAnyDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Report</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the report for &quot;{getFileName(report.file_path)}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate([report.id])}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ], [deletingIds, deleteMutation]);

  const table = useReactTable({
    data: reportsData.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      sorting,
      rowSelection,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const isDeleting = deletingIds.size > 0;

  return (
    <div className="py-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Evaluation Reports</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading reports...'
                : viewMode === 'me'
                  ? `Your evaluation reports (${reportsData.total})`
                  : `View and manage BPMN model evaluation reports (${reportsData.total})`
              }
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Tabs value={viewMode} onValueChange={(v: string) => handleViewModeChange(v as ViewMode)}>
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
            <Button asChild size="sm" className="hover:cursor-pointer">
              <Link href="/dashboard/analysis/new">New Analysis</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && <LoadingReports />}

          {/* Content - only when not loading */}
          {!loading && (
            <>
          {error && (
            <div className="mb-4">
              <ErrorAlert error={error} onRetry={() => refetch()} isRetrying={isFetching} />
            </div>
          )}

          {selectedCount > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {selectedCount} report{selectedCount > 1 ? 's' : ''} selected
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedCount} Report{selectedCount > 1 ? 's' : ''}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedCount} report{selectedCount > 1 ? 's' : ''}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(selectedRows.map((row) => row.original.id))}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.resetRowSelection()}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Selection
              </Button>
            </div>
          )}

          {reportsData.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                {viewMode === 'me'
                  ? "You don't have any evaluation reports yet. Run an analysis on one of your models."
                  : "No evaluation reports found. Run an analysis on a model to generate a report."
                }
              </p>
            </div>
          ) : (
            <div className={`rounded-md border transition-opacity ${isFetching && !loading ? 'opacity-50' : ''}`}>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!error && reportsData.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <Tabs value={String(pageSize)} onValueChange={(v: string) => handlePageSizeChange(Number(v) as PageSize)}>
                <TabsList>
                  <TabsTrigger value="10" >10</TabsTrigger>
                  <TabsTrigger value="15">15</TabsTrigger>
                  <TabsTrigger value="20">20</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * pageSize + 1, reportsData.total)}-{Math.min(page * pageSize, reportsData.total)} of {reportsData.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingReports() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
