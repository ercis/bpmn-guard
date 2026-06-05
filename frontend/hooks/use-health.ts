'use client';

import { useQuery } from '@tanstack/react-query';

const MAX_HISTORY = 30;
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'health-check-history';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unreachable' | 'timeout' | 'error';
  database: string;
  llm_api: string;
  bpmn_validation: string;
  responseTimeMs?: number;
}

export interface HealthCheckEntry {
  timestamp: number;
  status: string;
  responseTimeMs?: number;
}

// Load history from localStorage
function loadHistory(): HealthCheckEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save entry to history in localStorage
function saveToHistory(entry: HealthCheckEntry) {
  if (typeof window === 'undefined') return;
  try {
    const history = loadHistory();
    // Don't add near-duplicate entries (within 1 second of most recent)
    if (history.length > 0 && Math.abs(history[0].timestamp - entry.timestamp) < 1000) {
      return;
    }
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

async function fetchHealth(): Promise<HealthStatus> {
  const startTime = performance.now();
  const response = await fetch('/api/health');
  const responseTimeMs = Math.round(performance.now() - startTime);

  if (!response.ok) {
    // Try to parse the error response body (API returns health status even on error)
    const data = await response.json().catch(() => null);
    if (data && data.status) {
      const health = { ...data, responseTimeMs } as HealthStatus;
      saveToHistory({ timestamp: Date.now(), status: health.status, responseTimeMs });
      return health;
    }
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const data = await response.json();
  const health = { ...data, responseTimeMs };
  saveToHistory({ timestamp: Date.now(), status: health.status, responseTimeMs });
  return health;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: true,
    retry: false, // Don't retry on failure - we want to show the error immediately
    staleTime: 25000, // Consider data fresh for 25 seconds
  });
}

export function getHealthHistory(): HealthCheckEntry[] {
  const now = Date.now();
  return loadHistory().filter(entry => now - entry.timestamp < MAX_AGE_MS);
}
