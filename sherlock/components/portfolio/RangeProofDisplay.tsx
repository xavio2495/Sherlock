'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { generateZKProof } from '@/lib/api';
import { Lock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RangeProofDisplayProps {
  tokenId: number;
  actualAmount: number;
  assetType: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RangeProofDisplay({
  tokenId,
  actualAmount,
  assetType,
  isOpen,
  onClose,
}: RangeProofDisplayProps) {
  const [proof, setProof] = useState<string | null>(null);
  const [publicSignals, setPublicSignals] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minRange = Math.max(0, actualAmount - 5);
  const maxRange = actualAmount + 5;

  const handleGenerateProof = async () => {
    setLoading(true);
    setError(null);

    try {
      toast.info('⏳ Generating zero-knowledge range proof...');

      const response = await generateZKProof({
        proofType: 'range',
        userAddress: '0x0000000000000000000000000000000000000000', // Not needed for range proof
        inputs: {
          tokenId,
          actualAmount,
          minRange,
          maxRange,
        },
      });

      setProof(response.proof);
      setPublicSignals(response.publicSignals);
      toast.success('✓ Range proof generated successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate proof';
      setError(errorMessage);
      toast.error('Proof generation failed', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProof(null);
    setPublicSignals(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-zk-proof" />
            Zero-Knowledge Range Proof
          </DialogTitle>
          <DialogDescription>
            Prove your ownership is within a range without revealing the exact amount
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Asset Info */}
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Asset</p>
              <p className="font-semibold">
                {assetType} #{tokenId}
              </p>
            </div>
            <Badge className="bg-zk-proof">Privacy Protected</Badge>
          </div>

          {/* Range Information */}
          <Card className="border-zk-proof/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-zk-proof mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold mb-2">Verified Ownership Range</p>
                  <div className="p-4 bg-zk-proof/10 rounded-lg">
                    <p className="text-3xl font-bold text-zk-proof">
                      {minRange} - {maxRange} fractions
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Your exact holdings (
                    <span className="font-semibold">{actualAmount} fractions</span>) remain
                    completely private on-chain. Only you know the precise amount.
                  </p>
                </div>
              </div>

              {/* How it Works */}
              <div className="mt-4 p-3 bg-secondary/30 rounded-lg text-xs space-y-2">
                <p className="font-semibold">🔐 How Zero-Knowledge Proofs Work:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    • Proves you own between {minRange}-{maxRange} fractions
                  </li>
                  <li>• Does NOT reveal your exact holdings ({actualAmount})</li>
                  <li>• Verifiable by anyone without exposing private data</li>
                  <li>• Cryptographically secured using Circom circuits</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Proof Generation */}
          {!proof && !loading && !error && (
            <Button
              onClick={handleGenerateProof}
              className="w-full bg-zk-proof hover:bg-zk-proof/90"
            >
              <Lock className="mr-2 h-4 w-4" />
              Generate Zero-Knowledge Proof
            </Button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center gap-3 p-6 text-zk-proof">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Generating cryptographic proof...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-600">Proof Generation Failed</p>
                <p className="text-sm text-red-600/80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success State */}
          {proof && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">✓ Proof Successfully Generated</span>
              </div>

              {/* Proof Details */}
              <details className="p-3 bg-secondary/20 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm hover:text-zk-proof">
                  View Proof Commitment Hash
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Proof Hash:</p>
                    <code className="text-xs break-all bg-black/5 dark:bg-white/5 p-2 rounded block">
                      {proof.slice(0, 100)}...
                    </code>
                  </div>
                  {publicSignals && publicSignals.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Public Signals:</p>
                      <code className="text-xs break-all bg-black/5 dark:bg-white/5 p-2 rounded block">
                        {publicSignals.join(', ')}
                      </code>
                    </div>
                  )}
                </div>
              </details>

              <p className="text-xs text-center text-muted-foreground">
                This proof can be verified on-chain without revealing your exact balance
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {proof && (
            <Button onClick={handleGenerateProof} variant="outline" disabled={loading}>
              Regenerate Proof
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
