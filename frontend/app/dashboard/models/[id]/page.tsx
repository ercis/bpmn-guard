'use client';

import { use } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Trash2, Download, FileText, ChevronRight, Calendar } from 'lucide-react';
import type { BPMNModel } from '@/types/schemas';
import { formatDate } from '@/lib/date';
import { formatFileSize } from '@/lib/format';
import { ErrorAlert } from '@/components/error-alert';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

function getRatingBadgeVariant(rating: number | null): 'success' | 'secondary' | 'destructive' {
  if (rating === null) return 'secondary';
  if (rating >= 8) return 'success';
  if (rating >= 5) return 'secondary';
  return 'destructive';
}

export default function ModelDetailPage({ params }: PageProps) {
  const { id: modelId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch model query
  const {
    data: model,
    isLoading: loading,
    error: queryError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['model', modelId],
    queryFn: async () => {
      const res = await fetch(`/api/models/${modelId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Model not found');
        throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch model');
      }
      return res.json() as Promise<BPMNModel>;
    },
    retry: (failureCount, error) => {
      if ((error as Error).message.includes('not found')) return false;
      return failureCount < 1;
    },
  });

  const error = queryError ? (queryError as Error).message : null;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/models/${modelId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete model');
      }
    },
    onMutate: () => {
      toast.loading('Deleting model...', { id: 'delete-model' });
    },
    onSuccess: () => {
      toast.success('Model deleted successfully', { id: 'delete-model' });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      router.push('/dashboard/models');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete model', { id: 'delete-model' });
    },
    onSettled: () => {
      setShowDeleteDialog(false);
    },
  });

  const handleDownload = async () => {
    if (!model) return;

    try {
      setDownloading(true);

      const response = await fetch(`/api/models/${model.id}/file`);
      if (!response.ok) throw new Error('Failed to download file from backend');
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.name}.${model.file_path.split('.').pop()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const disable = downloading || deleteMutation.isPending;

  if (loading) {
    return <LoadingModel />;
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="mb-6">
          <Link href="/dashboard/models">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to Models
            </Button>
          </Link>
        </div>
        <ErrorAlert error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      </div>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <div className="py-8">
      <div className="mb-6">
        <Link href="/dashboard/models">
          <Button variant="outline" className="hover:cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Models
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{model.name}</CardTitle>
                <CardDescription>
                  Model ID: {model.id}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-base">
                v{model.version}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {disable ? (
                <Button disabled className="hover:cursor-pointer">
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <Link href={`/dashboard/models/${modelId}/edit`}>
                  <Button variant="secondary" className="hover:cursor-pointer">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              )}
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={disable} className="hover:cursor-pointer">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={disable} className="hover:cursor-pointer">
                <Download className="h-4 w-4" />
                {downloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete BPMN Model</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{model.name}</strong>? This action cannot be undone and will permanently remove the model from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} className="hover:cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:cursor-pointer"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Description Section - Full Width */}
        {model.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed">{model.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Model Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Model Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-base">{model.name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Version</p>
                <p className="text-base">{model.version}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">File Size</p>
                <p className="text-base">{formatFileSize(model.file_size)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Created At</p>
                <p className="text-base">{formatDate(model.created_at)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{formatDate(model.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Reports */}
        {model.reports && model.reports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Evaluation Reports
              </CardTitle>
              <CardDescription>
                {model.reports.length} report{model.reports.length !== 1 ? 's' : ''} for this model
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...model.reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Report {report.id.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(report.created_at)}
                          </span>
                          <Badge variant={getRatingBadgeVariant(report.evaluation_rating)} className="md:hidden">
                            {report.evaluation_rating !== null ? `${report.evaluation_rating}/10` : 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getRatingBadgeVariant(report.evaluation_rating)} className="hidden md:inline-flex">
                        {report.evaluation_rating !== null ? `${report.evaluation_rating}/10` : 'N/A'}
                      </Badge>
                      <Link href={`/dashboard/reports/${report.id}`}>
                        <Button variant="outline" size="sm" className="hover:cursor-pointer">
                          <span className="hidden sm:inline">View Report</span>
                          <span className="sm:hidden">View</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoadingModel() {
  return (
    <div className="py-8">
      <div className="mb-6">
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48 sm:w-64" />
            <Skeleton className="h-4 w-full max-w-2/3" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-28" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
