'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllAssets, getAssetMetadata } from '@/lib/api';
import type { AssetMetadataResponse, AssetWithBackendData } from '@/types';

/**
 * Hook to fetch all RWA assets from backend API
 * Returns enriched data including economics and fraction specs
 * @returns Array of assets with backend data
 */
export function useAllAssetsFromBackend(options?: {
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}) {
  return useQuery<AssetWithBackendData[]>({
    queryKey: ['assets-backend'],
    queryFn: async () => {
      const results = await getAllAssets();
      
      // Transform backend response to AssetWithBackendData format
      return results.map((result: any) => {
        const asset: AssetWithBackendData = {
          tokenId: result.tokenId,
          issuer: result.metadata.issuer as `0x${string}`,
          documentHash: result.metadata.documentHash,
          totalValue: result.metadata.totalValue,
          fractionCount: result.metadata.fractionCount,
          minFractionSize: result.metadata.minFractionSize,
          mintTimestamp: result.metadata.mintTimestamp,
          oraclePriceAtMint: result.metadata.oraclePriceAtMint,
          verified: result.metadata.verified,
          assetType: determineAssetType(result.metadata.documentHash, result.tokenId),
          soldFractions: result.economics.soldFractions,
          availableFractions: result.economics.availableFractions,
          pricePerFraction: parseFloat(result.economics.pricePerFraction),
          isActive: result.fractionSpec.isActive,
          priceId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' as `0x${string}`, // ETH/USD price feed
        };
        return asset;
      });
    },
    refetchInterval: options?.refetchInterval || 30000, // Default 30s
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch a single RWA asset from backend API
 * @param tokenId - Token ID to fetch
 * @returns Asset metadata response from backend
 */
export function useAssetFromBackend(tokenId: number) {
  return useQuery<AssetMetadataResponse>({
    queryKey: ['asset-backend', tokenId],
    queryFn: () => getAssetMetadata(tokenId),
    enabled: tokenId > 0,
    retry: 2,
  });
}

/**
 * Determine asset type based on document hash pattern or token ID
 * This is a helper function - in production, asset type should come from contract events
 */
function determineAssetType(documentHash: string, tokenId: number): string {
  // Simple pattern matching based on document hash or token ID
  if (documentHash.includes('Invoice') || tokenId % 3 === 1) {
    return 'Invoice';
  } else if (documentHash.includes('Bond') || tokenId % 3 === 2) {
    return 'Bond';
  } else {
    return 'Real Estate';
  }
}

