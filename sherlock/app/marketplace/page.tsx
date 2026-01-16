'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAllAssetsFromBackend } from '@/hooks/useBackendAssets';
import { AssetCard } from '@/components/marketplace/AssetCard';
import { PurchaseModal } from '@/components/marketplace/PurchaseModal';
import { AssetCardSkeleton } from '@/components/shared/AssetCardSkeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { AssetWithBackendData } from '@/types';
import { ArrowUpDown, Filter } from 'lucide-react';

const ASSET_TYPES = ['All', 'Invoice', 'Bond', 'Real Estate'] as const;
type AssetType = (typeof ASSET_TYPES)[number];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'value-high', label: 'Value (High to Low)' },
  { value: 'value-low', label: 'Value (Low to High)' },
  { value: 'availability', label: 'Most Available' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get filters from URL params
  const filterParam = (searchParams.get('filter') as AssetType) || 'All';
  const sortParam = (searchParams.get('sort') as SortOption) || 'newest';

  const [selectedAsset, setSelectedAsset] = useState<AssetWithBackendData | null>(null);

  // Fetch all assets with 30s refresh from backend API (pauses when tab not focused)
  const {
    data: assets,
    isLoading,
    error,
  } = useAllAssetsFromBackend({
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // Update URL params
  const updateFilter = (filter: AssetType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === 'All') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    router.push(`/marketplace?${params.toString()}`);
  };

  const updateSort = (sort: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    router.push(`/marketplace?${params.toString()}`);
  };

  // Filter and sort assets
  const processedAssets = useMemo(() => {
    if (!assets) return [];

    // Filter by asset type
    let filtered = assets.filter((asset) => {
      if (filterParam === 'All') return true;
      return asset.assetType === filterParam;
    });

    // Filter out fully sold assets (use availableFractions from backend)
    filtered = filtered.filter((asset) => {
      return asset.availableFractions > 0;
    });

    // Sort assets
    const sorted = [...filtered].sort((a, b) => {
      switch (sortParam) {
        case 'newest':
          return b.tokenId - a.tokenId;
        case 'value-high':
          return b.totalValue - a.totalValue;
        case 'value-low':
          return a.totalValue - b.totalValue;
        case 'availability': {
          const availA = a.availableFractions;
          const availB = b.availableFractions;
          return availB - availA;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [assets, filterParam, sortParam]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">Failed to load marketplace assets</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  // Empty state
  if (!assets || processedAssets.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">No RWAs Available</h2>
          <p className="text-muted-foreground">
            {filterParam !== 'All'
              ? `No ${filterParam} assets available yet.`
              : 'Be the first issuer to mint RWA tokens!'}
          </p>
          <div className="flex gap-4 justify-center mt-6">
            {filterParam !== 'All' && (
              <Button variant="outline" onClick={() => updateFilter('All')}>
                Clear Filter
              </Button>
            )}
            <Link href="/issuer">
              <Button>Become an Issuer</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">
            {processedAssets.length} RWA{processedAssets.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap gap-3">
          {/* Asset Type Filter */}
          <Select value={filterParam} onValueChange={updateFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortParam} onValueChange={updateSort}>
            <SelectTrigger className="w-[200px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {processedAssets.map((asset) => (
          <AssetCard
            key={asset.tokenId}
            asset={asset}
            onPurchaseClick={() => setSelectedAsset(asset)}
          />
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedAsset && (
        <PurchaseModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-10 w-48" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
