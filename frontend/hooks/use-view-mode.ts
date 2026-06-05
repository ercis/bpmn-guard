'use client';

import { useSyncExternalStore } from 'react';
import type { ViewMode } from '@/types/schemas';

const STORAGE_KEY = 'view-mode';
const DEFAULT_VALUE: ViewMode = 'all';

// Listeners for cross-component sync
const listeners = new Set<() => void>();

// Initialize from localStorage at module load (browser only)
let currentValue: ViewMode = DEFAULT_VALUE;
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'all' || stored === 'me') {
    currentValue = stored;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ViewMode {
  return currentValue;
}

function getServerSnapshot(): ViewMode {
  return DEFAULT_VALUE;
}

function setValue(value: ViewMode) {
  currentValue = value;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
  listeners.forEach((listener) => listener());
}

/**
 * Hook for synced view mode state across components with localStorage persistence.
 * All components using this hook share the same state.
 */
export function useViewMode() {
  return [useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), setValue] as const;
}
