'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
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
import { Info, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X, Loader2, Users, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorAlert } from '@/components/error-alert';
import { toast } from 'sonner';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState
} from '@tanstack/react-table';
import type { ModelsResponse, BPMNModel, ViewMode } from '@/types/schemas';
import { formatDateShort } from '@/lib/date';
import { formatFileSize } from '@/lib/format';

export default function ModelsPage() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode();
  const [pageSize, setPageSize] = usePageSize();
  const [page, setPage] = useState(1);

  // Map frontend column IDs to backend sort field names
  const sortBy = sorting[0]?.id ?? 'created_at';
  const sortDirection = sorting[0]?.desc === false ? 'asc' : 'desc';

  const {
    data: modelsData = { total: 0, items: [] },
    isLoading: loading,
    error: queryError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['models', { page, pageSize, viewMode, sortBy, sortDirection }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        view: viewMode,
        sort_by: sortBy,
        sort_direction: sortDirection,
      });
      const res = await fetch(`/api/models?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch models');
      return res.json() as Promise<ModelsResponse>;
    },
    placeholderData: keepPreviousData,
  });

  const error = queryError ? (queryError as Error).message : null;

  const totalPages = Math.ceil(modelsData.total / pageSize);

  // Clamp page when total shrinks (e.g. after deleting items)
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  // Reset page to 1 when viewMode or pageSize changes
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
      // Delete models in parallel using Promise.allSettled
      const deletePromises = ids.map(async (id) => {
        const res = await fetch(`/api/models/${id}`, { method: 'DELETE' });
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
          const modelName = modelsData.items.find(m => m.id === id)?.name;
          errors.push({
            id,
            name: modelName,
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
          toast.success('Model deleted successfully');
        } else {
          toast.success(`Successfully deleted ${successfulDeletes.length} model${successfulDeletes.length > 1 ? 's' : ''}`);
        }
        setRowSelection({});
      } else if (successfulDeletes.length === 0) {
        // All failed
        if (isSingleDelete) {
          toast.error(`Failed to delete model: ${errors[0].error}`);
        } else {
          toast.error(`Failed to delete ${errors.length} model${errors.length > 1 ? 's' : ''}`);
        }
      } else {
        // Partial success
        toast.warning(
          `Deleted ${successfulDeletes.length} of ${successfulDeletes.length + errors.length} models. ${errors.length} failed.`,
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

      // Invalidate and refetch models list
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete models');
    },
    onSettled: () => {
      setDeletingIds(new Set());
    },
  });



  const columns: ColumnDef<BPMNModel>[] = useMemo(() => [
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
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 hover:cursor-pointer"
          >
            Name
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
      cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
    },
    {
      accessorKey: 'version',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 hover:cursor-pointer"
          >
            Version
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
      cell: ({ row }) => <Badge variant="secondary">{row.getValue('version')}</Badge>,
    },
    {
      accessorKey: 'file_size',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 hover:cursor-pointer"
          >
            File Size
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
          {formatFileSize(row.getValue('file_size'))}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 hover:cursor-pointer"
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
      accessorKey: 'updated_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 hover:cursor-pointer"
          >
            Updated
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
          {formatDateShort(row.getValue('updated_at'))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const model = row.original;
        const isDeleting = deletingIds.has(model.id);
        const isAnyDeleting = deletingIds.size > 0;

        return (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="hover:cursor-pointer">
              <Link href={`/dashboard/models/${model.id}`}>
                <Info className="h-4 w-4 mr-1" />
                Details
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isAnyDeleting}
                  className="hover:cursor-pointer"
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
                  <AlertDialogTitle>Delete Model</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{model.name}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="hover:cursor-pointer">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate([model.id])} className="hover:cursor-pointer">
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
    data: modelsData.items,
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
            <CardTitle>BPMN Models</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading models...'
                : viewMode === 'me'
                  ? `Your uploaded models (${modelsData.total})`
                  : `Manage and view your BPMN process models (${modelsData.total})`
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
              <Link href="/dashboard/models/upload">Upload Model</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && <LoadingModels />}

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
                {selectedCount} model{selectedCount > 1 ? 's' : ''} selected
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                    className="hover:cursor-pointer"
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
                    <AlertDialogTitle>Delete {selectedCount} Model{selectedCount > 1 ? 's' : ''}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedCount} model{selectedCount > 1 ? 's' : ''}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="hover:cursor-pointer">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(selectedRows.map((row) => row.original.id))} className="hover:cursor-pointer">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.resetRowSelection()}
                className="hover:cursor-pointer"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Selection
              </Button>
            </div>
          )}

          {modelsData.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                {viewMode === 'me'
                  ? "You haven't uploaded any models yet. Upload your first model to get started."
                  : "No BPMN models found. Upload your first model to get started."
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
          {!error && modelsData.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <Tabs value={String(pageSize)} onValueChange={(v: string) => handlePageSizeChange(Number(v) as PageSize)}>
                <TabsList>
                  <TabsTrigger value="10" >10</TabsTrigger>
                  <TabsTrigger value="15">15</TabsTrigger>
                  <TabsTrigger value="20">20</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * pageSize + 1, modelsData.total)}-{Math.min(page * pageSize, modelsData.total)} of {modelsData.total}
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

function LoadingModels() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
