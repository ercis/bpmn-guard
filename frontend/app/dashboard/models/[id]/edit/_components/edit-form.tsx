'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import type { BPMNModel } from '@/types/schemas';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/xml', 'text/xml'];
const ALLOWED_EXTENSIONS = ['bpmn', 'xml'];

interface EditFormProps {
  model: BPMNModel;
  modelId: string;
}

export function EditForm({ model, modelId }: EditFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Initialize form state directly from propsW
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description || '');
  const [version, setVersion] = useState(model.version);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setNewFile(null);
      return;
    }

    // Validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      setFileError(`Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setNewFile(null);
      return;
    }

    // Validate MIME type
    // Note: Some browsers may not set MIME type for .bpmn files, so we allow empty MIME type
    // as long as the file extension is valid. The backend will perform additional validation.
    if (file.type !== '' && !ALLOWED_MIME_TYPES.includes(file.type)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
      setNewFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File size exceeds maximum allowed size of ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
      setNewFile(null);
      return;
    }

    setNewFile(file);
  };

  // Check if metadata has changed
  const hasMetadataChanged = () => {
    return (
      name.trim() !== model.name ||
      (description.trim() === "" ? null : description.trim()) !== (model.description || null) ||
      version.trim() !== model.version
    );
  };

  // Update metadata mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string | null; version: string } }) => {
      const response = await fetch(`/api/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update metadata');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (error: Error) => {
      console.error('Error updating metadata:', error);
    },
  });

  // Replace file mutation
  const replaceFileMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/models/${id}/file`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to replace file');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (error: Error) => {
      console.error('Error replacing file:', error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const metadataChanged = hasMetadataChanged();
    const fileChanged = newFile !== null;

    // If nothing changed, show message
    if (!metadataChanged && !fileChanged) {
      toast.info('No changes to save');
      return;
    }

    try {
      toast.loading('Updating model...', { id: 'update-model' });

      // Update metadata if changed
      if (metadataChanged) {
        toast.loading('Updating metadata...', { id: 'update-model' });
        await updateMetadataMutation.mutateAsync({
          id: modelId,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            version: version.trim(),
          },
        });
      }

      // Replace file if provided (this also updates description)
      if (fileChanged && newFile) {
        toast.loading('Replacing file and regenerating description...', { id: 'update-model' });
        await replaceFileMutation.mutateAsync({
          id: modelId,
          file: newFile,
        });
      }

      toast.success('Model updated successfully', { id: 'update-model' });
      router.push(`/dashboard/models/${modelId}`);
    } catch (err) {
      console.error('Error updating model:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update model', { id: 'update-model' });
    }
  };

  const saving = updateMetadataMutation.isPending || replaceFileMutation.isPending;

  return (
    <div className="py-8">
      <div className="mb-6">
        <Link href={`/dashboard/models/${modelId}`}>
          <Button variant="outline" className="hover:cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Model
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit BPMN Model</CardTitle>
          <CardDescription>
            Update model metadata and optionally replace the file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Metadata Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Model Metadata</h3>
                <p className="text-sm text-muted-foreground">Update the model&apos;s name, description, and version</p>
              </div>

              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Model Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter model name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter model description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={saving}
                />
              </div>

              {/* Version */}
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  placeholder="1.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Optional</span>
              </div>
            </div>

            {/* File Replacement Section */}
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-2">
                <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-1 mt-0.5">
                  <svg
                    className="h-4 w-4 text-amber-600 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">Replace BPMN File</h3>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    Warning: Replacing the file will overwrite the existing BPMN model. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Upload New File (Optional)</Label>
                <div className="rounded-md bg-muted/50 p-3 border border-muted">
                  <Input
                    id="file"
                    type="file"
                    accept=".bpmn,.xml,application/xml,text/xml"
                    onChange={handleFileChange}
                    disabled={saving}
                    className="bg-background"
                  />
                </div>
                {newFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {newFile.name} ({(newFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {fileError && (
                  <p className="text-sm text-destructive">{fileError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Accepted formats: .bpmn, .xml (XML files) | Max size: {(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB
                </p>
                <p className="text-xs text-muted-foreground">
                  Current file: {model.name}.{model.file_path.split('.').pop()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !name.trim() || !version.trim() || !!fileError} className="hover:cursor-pointer">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/models/${modelId}`)}
                disabled={saving}
                className="hover:cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
