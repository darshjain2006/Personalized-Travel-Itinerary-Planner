import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { HealthResponse } from '../types';

export function useHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 10000, // poll every 10s to monitor backend connectivity
    retry: 2,
    staleTime: 5000,
  });
}
