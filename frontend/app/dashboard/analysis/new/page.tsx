'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, Loader2, Upload as UploadIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/upload/dropzone'
import { useSupabaseUpload } from '@/hooks/use-supabase-upload';
import type { ModelsResponse } from '@/types/schemas';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function AnalysisNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'upload'>('select');

  // Fetch models for dropdown
  const {
    data: modelsData = { total: 0, items: [] },
    isLoading: loadingModels,
  } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch models');
      return res.json() as Promise<ModelsResponse>;
    },
  });

  // Upload props for new model
  const uploadProps = useSupabaseUpload({
    bucketName: '',
    path: 'models',
    allowedMimeTypes: ['application/xml', 'text/xml', '.bpmn'],
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: 1,
  });

  // Upload mutation - uploads new model file and gets model ID
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/models', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to upload model');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate models cache so the list refreshes with the new model
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  // Submit mutation - starts analysis with a model ID
  const submitMutation = useMutation({
    mutationFn: async ({ modelId }: { modelId: string }) => {
      const res = await fetch('/api/analysis/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to start analysis');
      return res.json() as Promise<{ analysis_id: string }>;
    },
    onSuccess: (data) => {
      // Redirect to status page with the analysis ID
      router.push(`/dashboard/analysis/${data.analysis_id}/status`);
    },
    onError: (error: Error) => {
      setError(error.message || 'Failed to start analysis');
      setSubmitting(false);
    },
  });

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'upload') {
        // Upload new model first, then start analysis with the returned model ID
        if (uploadProps.files.length === 0) {
          setError('Please select a file to upload');
          setSubmitting(false);
          return;
        }

        const file = uploadProps.files[0];
        if (file.errors.length > 0) {
          setError('Please fix file errors before submitting');
          setSubmitting(false);
          return;
        }

        // Step 1: Upload the file to get model ID
        const uploadedModel = await uploadMutation.mutateAsync(file);

        // Step 2: Start analysis with the model ID from upload response
        await submitMutation.mutateAsync({ modelId: uploadedModel.id });
      } else {
        // Use existing model
        if (!selectedModelId) {
          setError('Please select a model');
          setSubmitting(false);
          return;
        }

        await submitMutation.mutateAsync({ modelId: selectedModelId });
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process request');
      setSubmitting(false);
    }
  };

  return (
    <div className="py-8">
      <div className="mb-6">
        <Link href="/dashboard/analysis" className="flex items-center gap-2">
          <Button variant="outline" className="hover:cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Analyses
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start New Analysis</CardTitle>
          <CardDescription>
            Select an existing model or upload a new one to begin the analysis process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Model Selection Type */}
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'select' | 'upload')}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="select" id="select" className="peer sr-only" />
                  <Label
                    htmlFor="select"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      className="mb-3 h-6 w-6"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <div className="text-center">
                      <div className="font-medium">Existing Model</div>
                      <div className="text-xs text-muted-foreground">From your library</div>
                    </div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="upload" id="upload" className="peer sr-only" />
                  <Label
                    htmlFor="upload"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <UploadIcon className="mb-3 h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Upload New</div>
                      <div className="text-xs text-muted-foreground">BPMN or XML file</div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {/* Existing Model Selection */}
            {mode === 'select' ? (
              <div className="space-y-2">
                <Label htmlFor="model-select">Select Model *</Label>
                {loadingModels ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading models...</span>
                  </div>
                ) : modelsData.items.length === 0 ? (
                  <div className="p-4 border rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">
                      No models available. Please upload a new model.
                    </p>
                  </div>
                ) : (
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger id="model-select" className="w-full">
                      <SelectValue placeholder="Choose a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {modelsData.items.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2 min-w-0 max-w-full">
                              <span className="font-medium truncate">{model.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">-</span>
                              <span className="text-xs text-muted-foreground truncate">{model.id}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Select a BPMN model from your uploaded models
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Upload Model File *</Label>
                <Dropzone {...uploadProps}>
                  <DropzoneEmptyState />
                  <DropzoneContent />
                </Dropzone>
                <p className="text-xs text-muted-foreground">
                  Accepted formats: .bpmn, .xml (XML files) | Max size: 5MB
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting || (mode === 'select' && !selectedModelId) || (mode === 'upload' && uploadProps.files.length === 0) || loadingModels}
                size="lg"
                className="hover:cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting Analysis...
                  </>
                ) : (
                  'Start Analysis'
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/analysis')}
                disabled={submitting}
                size="lg"
                className="hover:cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
