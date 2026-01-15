'use client';

import { useQuery } from '@tanstack/react-query';
import { getOraclePrices } from '@/lib/api';
import type { OraclePricesResponse } from '@/types';

/**
 * Hook to fetch oracle prices from backend
 * Auto-refreshes every 30 seconds for real-time updates
 * @returns Oracle price data for ETH, BTC, USDC
 */
export function useOraclePrices() {
  return useQuery<OraclePricesResponse>({
    queryKey: ['oracle-prices'],
    queryFn: getOraclePrices,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
