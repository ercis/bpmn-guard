'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ChatMessage, ChatHistoryResponse } from '@/types/schemas';
import type { ChatStatus } from 'ai';

interface UseChatReturn {
  messages: ChatMessage[];
  streamingContent: string;
  isLoadingHistory: boolean;
  status: ChatStatus;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  isClearingChat: boolean;
  cancelRequest: () => void;
}

// Helper to extract user-friendly error message from API response
async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

export function useChat(reportId: string): UseChatReturn {
  const queryClient = useQueryClient();
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [status, setStatus] = useState<ChatStatus>('ready');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch existing chat history
  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat-history', reportId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${reportId}/history`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch chat history');
      return res.json() as Promise<ChatHistoryResponse>;
    },
    enabled: !!reportId,
    retry: false,
  });

  const messages = history?.messages ?? [];

  // Send message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || status === 'streaming' || status === 'submitted') return;

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<ChatHistoryResponse>(
      ['chat-history', reportId],
      (old) => ({
        messages: [...(old?.messages ?? []), userMessage],
        total: (old?.total ?? 0) + 1,
      })
    );

    setStatus('submitted');
    setStreamingContent('');

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          message: content.trim(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const message = await getErrorMessage(response, 'Unable to send message.');
        throw new Error(message);
      }

      setStatus('streaming');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to receive response from server.');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      // Batch size and delay for smoother streaming with fewer re-renders
      const BATCH_SIZE = 5;
      const BATCH_DELAY_MS = 15;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Batch characters to reduce state updates
        for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
          const batch = chunk.slice(i, i + BATCH_SIZE);
          fullContent += batch;
          setStreamingContent(fullContent);
          await delay(BATCH_DELAY_MS);
        }
      }

      // Add assistant message to cache
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatHistoryResponse>(
        ['chat-history', reportId],
        (old) => ({
          messages: [...(old?.messages ?? []), assistantMessage],
          total: (old?.total ?? 0) + 1,
        })
      );

      setStatus('ready');

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('ready');
        return;
      }
      // Remove optimistic user message on error
      queryClient.setQueryData<ChatHistoryResponse>(
        ['chat-history', reportId],
        (old) => ({
          messages: (old?.messages ?? []).filter(m => m.id !== userMessage.id),
          total: Math.max(0, (old?.total ?? 1) - 1),
        })
      );
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message.';
      toast.error(errorMessage);
    } finally {
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  }, [reportId, status, queryClient]);

  // Clear/reset chat
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/chat/${reportId}/history`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to clear chat history');
    },
    onSuccess: () => {
      queryClient.setQueryData<ChatHistoryResponse>(
        ['chat-history', reportId],
        { messages: [], total: 0 }
      );
      toast.success('Chat history cleared.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to clear chat history.';
      toast.error(message);
    },
  });

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('ready');
  }, []);

  return {
    messages,
    streamingContent,
    isLoadingHistory,
    status,
    sendMessage,
    clearChat: clearChatMutation.mutate,
    isClearingChat: clearChatMutation.isPending,
    cancelRequest,
  };
}
