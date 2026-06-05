'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/upload/dropzone'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useSupabaseUpload } from '@/hooks/use-supabase-upload';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

interface UploadResult {
  succeeded: Array<{ fileName: string; created: { id: string } }>;
  failed: Array<{ fileName: string; reason: string }>;
  total: number;
}

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);

  const uploadProps = useSupabaseUpload({
    bucketName: '', // Not used - backend handles storage
    path: 'models',
    allowedMimeTypes: ['application/xml', 'text/xml', '.bpmn'],
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult> => {
      // Upload each file directly to backend (in parallel)
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/models', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to upload ${file.name}`);
        }

        const created = await response.json();
        return { fileName: file.name, created };
      });

      // Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled(uploadPromises);

      const failed: Array<{ fileName: string; reason: string }> = [];
      const succeeded: Array<{ fileName: string; created: { id: string } }> = [];

      results.forEach((result, idx) => {
        const fileName = files[idx].name;
        if (result.status === 'rejected') {
          const reason = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason || 'Unknown error');
          failed.push({ fileName, reason });
        } else {
          succeeded.push(result.value);
        }
      });

      // If all files failed, throw an error to trigger onError
      if (failed.length > 0 && succeeded.length === 0) {
        const errorMessages = failed
          .map(({ fileName, reason }) => `${fileName}: ${reason}`)
          .join('\n');
        throw new Error(`Failed to upload all files:\n${errorMessages}`);
      }

      return { succeeded, failed, total: files.length };
    },
    onSuccess: (data) => {
      // Invalidate models cache so the list refreshes with new uploads
      queryClient.invalidateQueries({ queryKey: ['models'] });

      // Redirect after a short delay
      const delay = data.failed.length > 0 ? 2000 : 500;
      setTimeout(() => {
        // Smart redirect: single successful upload goes to model detail page
        if (data.succeeded.length === 1 && data.failed.length === 0) {
          router.push(`/dashboard/models/${data.succeeded[0].created.id}`);
        } else {
          // Multiple files or partial failure: go to models list
          router.push('/dashboard/models');
        }
      }, delay);
    },
    onError: () => {},
  });

  const handleUploadAndCreate = () => {
    setValidationError(null);

    // Validate form
    if (uploadProps.files.length === 0) {
      setValidationError('Please select at least one file to upload');
      return;
    }

    // Check for file errors
    const hasErrors = uploadProps.files.some(file => file.errors.length > 0);
    if (hasErrors) {
      setValidationError('Please fix file errors before uploading');
      return;
    }

    // Trigger the mutation with the files
    uploadMutation.mutate(uploadProps.files as File[]);
  };

  // Derive display states from mutation
  const isUploading = uploadMutation.isPending;
  const uploadData = uploadMutation.data;
  const uploadError = uploadMutation.error?.message || validationError;

  // Build progress message from mutation data
  const getProgressMessage = () => {
    if (isUploading) {
      return `Uploading ${uploadProps.files.length} file${uploadProps.files.length > 1 ? 's' : ''}...`;
    }
    if (uploadData) {
      if (uploadData.failed.length > 0) {
        const failedNames = uploadData.failed
          .map(({ fileName, reason }) => `${fileName} (${reason})`)
          .join(', ');
        return `Uploaded ${uploadData.succeeded.length} of ${uploadData.total} files. Failed: ${failedNames}`;
      }
      return `Upload complete! ${uploadData.succeeded.length} file(s) uploaded successfully.`;
    }
    return null;
  };

  const progressMessage = getProgressMessage();
  const isSuccess = uploadData && uploadData.failed.length === 0;
  const isPartialSuccess = uploadData && uploadData.failed.length > 0 && uploadData.succeeded.length > 0;

  return (
    <div className="py-8">
      <div className="mb-6">
        <Link href="/dashboard/models" className="flex items-center gap-2">
          <Button variant="outline" className="hover:cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Models
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload BPMN Models</CardTitle>
          <CardDescription>
            Upload .bpmn or .xml files to create new process models. Model names are extracted from filenames and descriptions are auto-generated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Dropzone */}
            <div className="space-y-2">
              <Label>Files *</Label>
              <Dropzone {...uploadProps}>
                <DropzoneEmptyState />
                <DropzoneContent />
              </Dropzone>
              <p className="text-xs text-muted-foreground">
                Accepted formats: .bpmn, .xml (XML files) | Max size: 5MB per file | Max files: {MAX_FILES}
              </p>
            </div>

            {/* Progress Message */}
            {progressMessage && !uploadError && (
              <div className={`flex items-start gap-2 rounded-lg border p-4 ${
                isSuccess
                  ? 'border-green-500 bg-green-500/10'
                  : isPartialSuccess
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-primary bg-primary/10'
              }`}>
                {isUploading ? (
                  <Loader2 className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : isPartialSuccess ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                ) : null}
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${
                    isSuccess
                      ? 'text-green-600'
                      : isPartialSuccess
                        ? 'text-yellow-600'
                        : 'text-primary'
                  }`}>
                    {progressMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Upload Error</p>
                  <p className="text-sm text-destructive whitespace-pre-wrap">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleUploadAndCreate}
                disabled={isUploading || uploadProps.files.length === 0}
                className="hover:cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload & Create Models'
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  uploadProps.setFiles([]);
                  uploadMutation.reset();
                  setValidationError(null);
                }}
                disabled={isUploading || uploadProps.files.length === 0}
                className="hover:cursor-pointer"
              >
                Clear Files
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
