'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, User, Layers } from 'lucide-react';
import type { AssetWithId } from '@/lib/contracts';

interface AssetCardProps {
  asset: AssetWithId;
  onPurchaseClick: () => void;
}

export function AssetCard({ asset, onPurchaseClick }: AssetCardProps) {
  const totalValue = asset.totalValue / 100; // Convert from cents
  const available = asset.fractionCount - asset.soldFractions;
  const pricePerFraction = totalValue / asset.fractionCount;
  const isSoldOut = available === 0;

  // Format oracle price (assuming it's in same format as backend returns)
  const oraclePrice = asset.oraclePriceAtMint / 1e8; // Pyth uses 8 decimals
  const mintDate = new Date(asset.mintTimestamp * 1000);

  // Truncate address
  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

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
    <Card className="hover:scale-105 transition-transform duration-200 hover:border-mantle-secondary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getAssetTypeColor(asset.assetType)}>{asset.assetType}</Badge>
            <Badge variant="outline">#{asset.tokenId}</Badge>
            {isSoldOut && <Badge variant="destructive">Sold Out</Badge>}
          </div>
          {asset.verified && (
            <Badge variant="outline" className="border-green-500 text-green-500">
              ✓ Verified
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Total Value */}
        <div>
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Available Fractions */}
        <div className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Available:</span>
          <span className="font-semibold">
            {available}/{asset.fractionCount}
          </span>
        </div>

        {/* Price Per Fraction */}
        <div>
          <p className="text-sm text-muted-foreground">Price per Fraction</p>
          <p className="text-lg font-semibold">
            ${pricePerFraction.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Oracle Price at Mint */}
        <div className="flex items-start gap-2 text-sm bg-muted/50 p-3 rounded-lg">
          <TrendingUp className="h-4 w-4 text-mantle-secondary mt-0.5" />
          <div className="flex-1">
            <p className="text-muted-foreground">Oracle Price at Mint</p>
            <p className="font-semibold">${oraclePrice.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{mintDate.toLocaleDateString()}</p>
          </div>
        </div>

        {/* Issuer */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Issuer:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {truncateAddress(asset.issuer)}
          </code>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onPurchaseClick}
          disabled={isSoldOut}
          className="w-full bg-mantle-secondary hover:bg-mantle-secondary/90 text-black font-semibold"
          size="lg"
        >
          {isSoldOut ? 'Sold Out' : 'Purchase Fractions'}
        </Button>
      </CardFooter>
    </Card>
  );
}
