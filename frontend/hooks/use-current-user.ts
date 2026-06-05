'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/client';
import type { DemoUser as User } from '@/lib/demo';

/**
 * Hook for getting the current authenticated user with React Query caching.
 * Caches the user data to avoid redundant Supabase calls across components.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async (): Promise<User | null> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook for getting just the current user's ID.
 * Convenience wrapper around useCurrentUser.
 */
export function useCurrentUserId() {
  const { data: user, ...rest } = useCurrentUser();
  return {
    userId: user?.id ?? null,
    ...rest,
  };
}
