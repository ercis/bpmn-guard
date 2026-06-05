'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import type { BPMNModel } from '@/types/schemas';
import { EditForm } from './_components/edit-form';
import { ErrorAlert } from '@/components/error-alert';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditModelPage({ params }: PageProps) {
  const { id: modelId } = use(params);

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

  if (loading) {
    return <LoadingEditModel />;
  }

  if (error || !model) {
    return (
      <div className="py-8">
        <div className="mb-6">
          <Link href={`/dashboard/models/${modelId}`}>
            <Button variant="outline" className="hover:cursor-pointer">
              <ArrowLeft className="h-4 w-4" /> Back to Model
            </Button>
          </Link>
        </div>
        <ErrorAlert
          error={error || 'Model not found'}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  // Only render the form when data is available
  return <EditForm model={model} modelId={modelId} />;
}

function LoadingEditModel() {
  return (
    <div className="py-8">
      <div className="mb-6">
        <Skeleton className="h-10 w-40" />
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
