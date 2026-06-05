'use client';

import { useSyncExternalStore } from 'react';

type PageSize = 10 | 15 | 20;

const STORAGE_KEY = 'page-size';
const DEFAULT_VALUE: PageSize = 15;
const VALID_VALUES: PageSize[] = [10, 15, 20];

const listeners = new Set<() => void>();

let currentValue: PageSize = DEFAULT_VALUE;
if (typeof window !== 'undefined') {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  if (VALID_VALUES.includes(stored as PageSize)) {
    currentValue = stored as PageSize;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PageSize {
  return currentValue;
}

function getServerSnapshot(): PageSize {
  return DEFAULT_VALUE;
}

function setValue(value: PageSize) {
  currentValue = value;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(value));
  }
  listeners.forEach((listener) => listener());
}

/**
 * Hook for synced page size state across components with localStorage persistence.
 * All components using this hook share the same state.
 */
export function usePageSize() {
  return [useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), setValue] as const;
}

export type { PageSize };
