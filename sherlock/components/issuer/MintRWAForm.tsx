'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useMintRWA } from '@/hooks/useMintRWA';
import { useOraclePrices } from '@/hooks/useOraclePrices';
import { ZKProofStatus } from './ZKProofStatus';
import { TransactionStatus } from '@/components/shared/TransactionStatus';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const formSchema = z
  .object({
    assetType: z.enum(['Invoice', 'Bond', 'Real Estate'], {
      message: 'Please select an asset type',
    }),
    documentHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid 32-byte hex hash with 0x prefix'),
    totalValue: z
      .number()
      .int()
      .min(1, 'Minimum value is $1')
      .max(1000000, 'Maximum value is $1,000,000'),
    fractionCount: z
      .number()
      .int()
      .min(1, 'Minimum 1 fraction')
      .max(10000, 'Maximum 10,000 fractions'),
    minFractionSize: z.number().int().min(1, 'Minimum size is 1'),
    lockupPeriod: z.number().int().min(0, 'Cannot be negative'),
  })
  .refine((data) => data.minFractionSize <= data.fractionCount, {
    message: 'Min fraction size cannot exceed total fraction count',
    path: ['minFractionSize'],
  });

type FormData = z.infer<typeof formSchema>;

export function MintRWAForm() {
  const router = useRouter();
  const { address } = useAccount();
  const { mint, loading, proofStatus, txHash, tokenId, reset } = useMintRWA();
  const { data: oraclePrices, isLoading: pricesLoading } = useOraclePrices();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lockupPeriod: 0,
    },
  });

  const selectedAssetType = watch('assetType');

  const onSubmit = async (data: FormData) => {
    if (!address) return;

    try {
      await mint({
        issuerAddress: address,
        documentHash: data.documentHash,
        totalValue: data.totalValue * 100, // Convert to cents
        fractionCount: data.fractionCount,
        minFractionSize: data.minFractionSize,
        lockupPeriod: data.lockupPeriod || 0,
        assetType: data.assetType,
        zkProofInput: {
          commitment: '0x' + '0'.repeat(64), // Placeholder
          nullifier: '0x' + '0'.repeat(64), // Placeholder
        },
      });
    } catch (error) {
      console.error('Mint error:', error);
    }
  };

  // Show success state
  if (txHash && tokenId !== null) {
    return (
      <div className="space-y-6">
        <TransactionStatus txHash={txHash} status="success" />

        <Card className="border-mantle-secondary bg-green-50 dark:bg-green-950/10">
          <CardContent className="pt-6 text-center space-y-4">
            <div>
              <h3 className="text-2xl font-bold">🎉 Success!</h3>
              <p className="text-muted-foreground mt-2">
                Your RWA Token #{tokenId} has been minted successfully
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                }}
              >
                Mint Another
              </Button>
              <Button
                onClick={() => router.push('/marketplace')}
                className="bg-mantle-secondary hover:bg-mantle-secondary/90"
              >
                View Marketplace
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get ETH/USD price
  const ethPrice = oraclePrices?.prices?.find(
    (p) => p.feedId.includes('ETH') || p.feedId.includes('eth')
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Asset Type */}
      <div className="space-y-2">
        <Label htmlFor="assetType">Asset Type</Label>
        <Select
          value={selectedAssetType}
          onValueChange={(value) => setValue('assetType', value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select asset type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Invoice">Invoice</SelectItem>
            <SelectItem value="Bond">Bond</SelectItem>
            <SelectItem value="Real Estate">Real Estate</SelectItem>
          </SelectContent>
        </Select>
        {errors.assetType && <p className="text-sm text-destructive">{errors.assetType.message}</p>}
      </div>

      {/* Document Hash */}
      <div className="space-y-2">
        <Label htmlFor="documentHash">Document Hash (SHA-256)</Label>
        <Input id="documentHash" placeholder="0x..." {...register('documentHash')} />
        {errors.documentHash && (
          <p className="text-sm text-destructive">{errors.documentHash.message}</p>
        )}
      </div>

      {/* Total Value */}
      <div className="space-y-2">
        <Label htmlFor="totalValue">Total Value (USD)</Label>
        <div className="relative">
          <Input
            id="totalValue"
            type="number"
            placeholder="10000"
            {...register('totalValue', { valueAsNumber: true })}
            className="pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            USD
          </span>
        </div>
        {errors.totalValue && (
          <p className="text-sm text-destructive">{errors.totalValue.message}</p>
        )}
      </div>

      {/* Fraction Count */}
      <div className="space-y-2">
        <Label htmlFor="fractionCount">Fraction Count</Label>
        <Input
          id="fractionCount"
          type="number"
          placeholder="100"
          {...register('fractionCount', { valueAsNumber: true })}
        />
        {errors.fractionCount && (
          <p className="text-sm text-destructive">{errors.fractionCount.message}</p>
        )}
      </div>

      {/* Min Fraction Size */}
      <div className="space-y-2">
        <Label htmlFor="minFractionSize">Minimum Fraction Size</Label>
        <Input
          id="minFractionSize"
          type="number"
          placeholder="1"
          {...register('minFractionSize', { valueAsNumber: true })}
        />
        {errors.minFractionSize && (
          <p className="text-sm text-destructive">{errors.minFractionSize.message}</p>
        )}
      </div>

      {/* Lockup Period */}
      <div className="space-y-2">
        <Label htmlFor="lockupPeriod">Lockup Period (Optional)</Label>
        <div className="relative">
          <Input
            id="lockupPeriod"
            type="number"
            placeholder="0"
            {...register('lockupPeriod', { valueAsNumber: true })}
            className="pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            days
          </span>
        </div>
        {errors.lockupPeriod && (
          <p className="text-sm text-destructive">{errors.lockupPeriod.message}</p>
        )}
      </div>

      {/* Oracle Price Display */}
      {ethPrice && !pricesLoading && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-mantle-secondary" />
              <div>
                <p className="text-sm text-muted-foreground">Current Oracle Price</p>
                <p className="text-lg font-bold">ETH/USD: ${(ethPrice.price / 1e8).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(ethPrice.timestamp * 1000).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ZK Proof Status */}
      {proofStatus !== 'idle' && <ZKProofStatus status={proofStatus} />}

      {/* Transaction Status */}
      {txHash && !tokenId && <TransactionStatus txHash={txHash} status="pending" />}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-mantle-secondary hover:bg-mantle-secondary/90 text-black"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Generate ZK Proof & Mint'
        )}
      </Button>
    </form>
  );
}
