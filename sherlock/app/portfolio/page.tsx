'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useAllAssetsFromBackend } from '@/hooks/useBackendAssets';
import { useReadContracts } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts';
import { OwnedAssetCard } from '@/components/portfolio/OwnedAssetCard';
import { RangeProofDisplay } from '@/components/portfolio/RangeProofDisplay';
import { AssetCardSkeleton } from '@/components/shared/AssetCardSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import type { AssetWithBackendData } from '@/types';

interface OwnedAsset extends AssetWithBackendData {
  balance: number;
}

interface ProofModalState {
  isOpen: boolean;
  asset: OwnedAsset | null;
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: allAssets, isLoading: assetsLoading } = useAllAssetsFromBackend();
  const [proofModal, setProofModal] = useState<ProofModalState>({
    isOpen: false,
    asset: null,
  });

  // Fetch balances for all assets
  const balanceQueries = useReadContracts({
    contracts:
      allAssets?.map((asset) => ({
        ...CONTRACTS.RWATokenFactory,
        functionName: 'balanceOf',
        args: address ? [address, BigInt(asset.tokenId)] : undefined,
      })) || [],
    query: {
      enabled: !!address && !!allAssets && allAssets.length > 0,
    },
  });

  // Filter assets where user has balance > 0
  const ownedAssets = useMemo(() => {
    if (!allAssets || !balanceQueries.data) return [];

    const owned: OwnedAsset[] = [];

    allAssets.forEach((asset, index) => {
      const balanceResult = balanceQueries.data[index];
      if (balanceResult?.status === 'success') {
        const balance = Number((balanceResult as any).result || 0);
        if (balance > 0) {
          owned.push({
            ...asset,
            balance,
          });
        }
      }
    });

    return owned;
  }, [allAssets, balanceQueries.data]);

  // Calculate total portfolio value (use pricePerFraction from backend)
  const totalPortfolioValue = useMemo(() => {
    return ownedAssets.reduce((total, asset) => {
      const assetValue = asset.balance * asset.pricePerFraction;
      return total + assetValue;
    }, 0);
  }, [ownedAssets]);

  // Loading state
  if (assetsLoading || balanceQueries.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-12 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected || !address) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <Wallet className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to view your RWA portfolio and holdings
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty portfolio state
  if (ownedAssets.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <Shield className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold">No RWA Holdings Yet</h2>
            <p className="text-muted-foreground">
              You don't own any RWA fractions yet. Visit the marketplace to start investing in
              tokenized real-world assets.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Link href="/marketplace">
                <Button>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Portfolio view
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">My Portfolio</h1>

        {/* Total Portfolio Value */}
        <Card className="bg-gradient-to-br from-mantle-secondary/10 to-zk-proof/10 border-mantle-secondary/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
                <p className="text-4xl font-bold">
                  $
                  {(totalPortfolioValue / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {ownedAssets.length} asset{ownedAssets.length !== 1 ? 's' : ''} • Privacy
                  protected via zero-knowledge proofs
                </p>
              </div>
              <Shield className="h-12 w-12 text-zk-proof" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Notice */}
      <div className="mb-6 p-4 bg-zk-proof/10 border border-zk-proof/20 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-zk-proof mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Privacy-Protected Holdings</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your exact holdings are private. Only ownership ranges are displayed to protect your
            financial privacy. Generate zero-knowledge range proofs to verify ownership without
            revealing exact amounts.
          </p>
        </div>
      </div>

      {/* Owned Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ownedAssets.map((asset) => (
          <OwnedAssetCard
            key={asset.tokenId}
            asset={asset}
            balance={asset.balance}
            onGenerateProof={() => setProofModal({ isOpen: true, asset })}
          />
        ))}
      </div>

      {/* Range Proof Modal */}
      {proofModal.asset && (
        <RangeProofDisplay
          tokenId={proofModal.asset.tokenId}
          actualAmount={proofModal.asset.balance}
          assetType={proofModal.asset.assetType}
          isOpen={proofModal.isOpen}
          onClose={() => setProofModal({ isOpen: false, asset: null })}
        />
      )}
    </div>
  );
}
