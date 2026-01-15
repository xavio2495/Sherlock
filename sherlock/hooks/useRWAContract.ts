import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts';
import type { AssetMetadata, AssetWithId } from '@/lib/contracts';
import type { UseQueryOptions } from '@tanstack/react-query';

/**
 * Hook to read asset metadata for a specific token ID
 * @param tokenId - The token ID to query
 * @returns Asset metadata including issuer, documentHash, totalValue, etc.
 */
export function useAssetMetadata(tokenId: bigint) {
  return useReadContract({
    ...CONTRACTS.RWATokenFactory,
    functionName: 'getAssetMetadata',
    args: [tokenId],
  });
}

/**
 * Hook to read user's balance for a specific RWA token
 * @param address - User's wallet address
 * @param tokenId - The token ID to query balance for
 * @returns User's fraction balance
 */
export function useUserBalance(address: `0x${string}` | undefined, tokenId: bigint) {
  return useReadContract({
    ...CONTRACTS.RWATokenFactory,
    functionName: 'balanceOf',
    args: address ? [address, tokenId] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to read metadata for multiple assets (batch read)
 * Reads tokenIds from 0-9 and filters out uninitialized assets
 * @param options - React Query options (refetchInterval, etc.)
 * @returns Array of valid asset metadata with transformed values
 */
export function useAllAssets(options?: {
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}) {
  // Create array of token IDs to query (0-9)
  const tokenIds = Array.from({ length: 10 }, (_, i) => BigInt(i));

  // Batch read all asset metadata
  const result = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      ...CONTRACTS.RWATokenFactory,
      functionName: 'getAssetMetadata',
      args: [tokenId],
    })),
    query: {
      refetchInterval: options?.refetchInterval,
      refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    },
  });

  // Asset type mapping (in real app, this would come from contract events or metadata)
  const assetTypes = [
    'Invoice',
    'Bond',
    'Real Estate',
    'Invoice',
    'Bond',
    'Real Estate',
    'Invoice',
    'Bond',
    'Real Estate',
    'Invoice',
  ];

  // Process results and filter out uninitialized assets
  const assets =
    result.data
      ?.map((item, index) => {
        if (item.status === 'success') {
          const metadata = (item as any).result as any[];
          // Check if asset is initialized (issuer is not zero address)
          if (metadata[0] && metadata[0] !== '0x0000000000000000000000000000000000000000') {
            // Transform bigint values to numbers for easier UI usage
            return {
              tokenId: Number(tokenIds[index]),
              issuer: metadata[0] as `0x${string}`,
              documentHash: metadata[1] as string,
              totalValue: Number(metadata[2]), // In cents
              fractionCount: Number(metadata[3]),
              minFractionSize: Number(metadata[4]),
              mintTimestamp: Number(metadata[5]),
              oraclePriceAtMint: Number(metadata[6]),
              priceId: metadata[7] as `0x${string}`,
              verified: metadata[8] as boolean,
              assetType: assetTypes[index] || 'Invoice',
              soldFractions: 0, // TODO: Fetch from contract events or balances
            } as AssetWithId;
          }
        }
        return null;
      })
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null) || [];

  return {
    data: assets,
    isError: result.isError,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/**
 * Hook to get the next token ID (total number of minted tokens)
 * @returns Next token ID that will be minted
 */
export function useNextTokenId() {
  return useReadContract({
    ...CONTRACTS.RWATokenFactory,
    functionName: 'nextTokenId',
  });
}
