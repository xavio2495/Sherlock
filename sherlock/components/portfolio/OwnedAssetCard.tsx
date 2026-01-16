'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, TrendingUp, Layers } from 'lucide-react';
import type { AssetWithId } from '@/lib/contracts';

interface OwnedAssetCardProps {
  asset: AssetWithId;
  balance: number;
  onGenerateProof: () => void;
}

export function OwnedAssetCard({ asset, balance, onGenerateProof }: OwnedAssetCardProps) {
  const pricePerFraction = asset.totalValue / asset.fractionCount;
  const currentValue = balance * pricePerFraction;
  const exactOwnershipPercent = (balance / asset.fractionCount) * 100;

  // Calculate privacy range: ±5 fractions from actual balance
  const minRange = Math.max(0, balance - 5);
  const maxRange = Math.min(asset.fractionCount, balance + 5);
  const minRangePercent = (minRange / asset.fractionCount) * 100;
  const maxRangePercent = (maxRange / asset.fractionCount) * 100;

  // Get asset type badge color
  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'Invoice':
        return 'bg-blue-500';
      case 'Bond':
        return 'bg-purple-500';
      case 'Real Estate':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="hover:border-mantle-secondary transition-colors duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getAssetTypeColor(asset.assetType)}>{asset.assetType}</Badge>
            <Badge variant="outline">#{asset.tokenId}</Badge>
          </div>
          {asset.verified && (
            <Badge variant="outline" className="border-green-500 text-green-500">
              ✓ Verified
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Privacy-Protected Ownership Range */}
        <div className="p-4 bg-zk-proof/10 border border-zk-proof/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-zk-proof" />
            <span className="text-sm font-medium text-zk-proof">Privacy Protected</span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">
              🔒 {minRange}-{maxRange} fractions
            </p>
            <p className="text-sm text-muted-foreground">
              {minRangePercent.toFixed(1)}% - {maxRangePercent.toFixed(1)}% ownership
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Exact holdings ({balance} fractions, {exactOwnershipPercent.toFixed(2)}%) remain
              private
            </p>
          </div>
        </div>

        {/* Current Value Estimate */}
        <div>
          <p className="text-sm text-muted-foreground">Estimated Value</p>
          <p className="text-2xl font-bold text-mantle-secondary">
            $
            {(currentValue / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {balance} fractions × ${(pricePerFraction / 100).toFixed(2)}
          </p>
        </div>

        {/* Asset Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Total Fractions</p>
            <p className="font-semibold">{asset.fractionCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Price at Mint</p>
            <p className="font-semibold">${(asset.oraclePriceAtMint / 1e8).toFixed(2)}</p>
          </div>
        </div>

        {/* Mint Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Minted {new Date(asset.mintTimestamp * 1000).toLocaleDateString()}</span>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onGenerateProof}
          variant="outline"
          className="w-full border-zk-proof text-zk-proof hover:bg-zk-proof/10"
        >
          <Lock className="mr-2 h-4 w-4" />
          Generate Range Proof
        </Button>
      </CardFooter>
    </Card>
  );
}
