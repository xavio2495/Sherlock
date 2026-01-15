'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FractionCalculator } from './FractionCalculator';
import { TransactionStatus } from '@/components/shared/TransactionStatus';
import { usePurchaseFractions } from '@/hooks/usePurchaseFractions';
import { AssetWithId } from '@/lib/contracts';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseModalProps {
  asset: AssetWithId;
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseModal({ asset, isOpen, onClose }: PurchaseModalProps) {
  const { address } = useAccount();
  const { purchase, loading, isSuccess, data, reset } = usePurchaseFractions();

  const [amount, setAmount] = useState<number>(1);
  const [isEligible, setIsEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  const pricePerFraction = asset.totalValue / asset.fractionCount;
  const totalCost = amount * pricePerFraction;
  const availableFractions = asset.fractionCount - (asset.soldFractions || 0);

  // Check eligibility on modal open (mock ZK-KYC check)
  useEffect(() => {
    if (isOpen && address) {
      setCheckingEligibility(true);
      // Simulate async eligibility check
      setTimeout(() => {
        setIsEligible(true);
        setCheckingEligibility(false);
      }, 1000);
    } else {
      setIsEligible(false);
      setCheckingEligibility(true);
    }
  }, [isOpen, address]);

  // Auto-close after successful purchase
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        handleClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  const handleClose = () => {
    reset();
    setAmount(1);
    onClose();
  };

  const handlePurchase = () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (amount < asset.minFractionSize) {
      toast.error(`Minimum purchase: ${asset.minFractionSize} fractions`);
      return;
    }

    if (amount > availableFractions) {
      toast.error(`Only ${availableFractions} fractions available`);
      return;
    }

    purchase({
      tokenId: asset.tokenId,
      amount,
      buyerAddress: address,
    });
  };

  const isValidAmount =
    amount >= asset.minFractionSize && amount <= availableFractions && amount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Purchase Fractions - {asset.assetType} #{asset.tokenId}
          </DialogTitle>
          <DialogDescription>Complete your purchase of fractional ownership</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Asset Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/20 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-lg font-semibold">${(asset.totalValue / 100).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available Fractions</p>
              <p className="text-lg font-semibold">
                {availableFractions.toLocaleString()} / {asset.fractionCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price per Fraction</p>
              <p className="text-lg font-semibold">
                $
                {(pricePerFraction / 100).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Min. Purchase</p>
              <p className="text-lg font-semibold">
                {asset.minFractionSize} fraction{asset.minFractionSize !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Eligibility Status */}
          <div className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg">
            {checkingEligibility ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm">Checking eligibility...</span>
              </>
            ) : isEligible ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">✓ Eligibility verified</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Connect wallet to verify eligibility</span>
              </>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Purchase</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={asset.minFractionSize}
              max={availableFractions}
              disabled={loading || !isEligible}
            />
            {amount < asset.minFractionSize && amount > 0 && (
              <p className="text-xs text-amber-600">Minimum: {asset.minFractionSize} fractions</p>
            )}
            {amount > availableFractions && (
              <p className="text-xs text-red-600">
                Maximum available: {availableFractions} fractions
              </p>
            )}
          </div>

          {/* Fraction Calculator */}
          <FractionCalculator
            totalValue={asset.totalValue}
            fractionCount={asset.fractionCount}
            minFractionSize={asset.minFractionSize}
            onAmountChange={(calculatedAmount) => {
              if (calculatedAmount >= asset.minFractionSize) {
                setAmount(calculatedAmount);
              }
            }}
          />

          {/* Total Cost */}
          <div className="p-4 bg-mantle-secondary/10 border border-mantle-secondary/20 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
            <p className="text-3xl font-bold">
              $
              {(totalCost / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {amount} fraction{amount !== 1 ? 's' : ''} × ${(pricePerFraction / 100).toFixed(2)}
            </p>
          </div>

          {/* Transaction Status */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-zk-proof" />
                <span>Generating ZK proof...</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting transaction...</span>
              </div>
            </div>
          )}

          {isSuccess && data && (
            <div className="space-y-2">
              <TransactionStatus txHash={data.txHash} status="success" />
              <p className="text-sm text-green-600">✓ Purchase complete! Redirecting...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!isValidAmount || loading || !isEligible || isSuccess}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Purchase'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
