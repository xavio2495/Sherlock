'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MintRWAForm } from '@/components/issuer/MintRWAForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNextTokenId } from '@/hooks/useRWAContract';
import { CheckCircle, FileText, Zap, Coins, X } from 'lucide-react';

export default function IssuerPage() {
  const { address, isConnected } = useAccount();
  const { data: nextTokenId } = useNextTokenId();
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Calculate total minted (nextTokenId is the next ID to be minted, so current count is nextTokenId)
  const totalMinted = nextTokenId ? Number(nextTokenId) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-3">Mint RWA Token</h1>
        <p className="text-lg text-muted-foreground">
          Tokenize real-world assets with privacy-preserving ZK proofs
        </p>
      </div>

      {/* Stats */}
      {totalMinted > 0 && (
        <Card className="mb-6 bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Coins className="h-5 w-5 text-mantle-secondary" />
              <p className="text-sm">
                <span className="font-bold text-2xl text-mantle-secondary">{totalMinted}</span>
                <span className="text-muted-foreground ml-2">RWA Tokens Minted</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card - How it works */}
      {showHowItWorks && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">How It Works</CardTitle>
                <CardDescription>Follow these simple steps to mint your RWA token</CardDescription>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center border-brutalist bg-background text-primary font-bold">
                  1
                </div>
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Fill Asset Details
                </p>
                <p className="text-sm text-muted-foreground">
                  Provide information about your real-world asset including type, value, and
                  fractionation
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center border-brutalist bg-background text-primary font-bold">
                  2
                </div>
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  ZK Proof Generated Automatically
                </p>
                <p className="text-sm text-muted-foreground">
                  Our system creates a zero-knowledge proof to verify eligibility without revealing
                  sensitive data
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center border-brutalist bg-background text-primary font-bold">
                  3
                </div>
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Transaction Submitted to Mantle
                </p>
                <p className="text-sm text-muted-foreground">
                  Your transaction is securely submitted to the Mantle Sepolia testnet
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center border-brutalist bg-background text-primary font-bold">
                  4
                </div>
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Token Minted with Unique ID
                </p>
                <p className="text-sm text-muted-foreground">
                  Receive your ERC-1155 token representing fractional ownership of the asset
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Main Content */}
      {!isConnected ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Connect your wallet to start minting RWA tokens</p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <MintRWAForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
