import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { mintRWA } from '@/lib/api';
import { mintRWASchema, type MintRWAFormData } from '@/lib/validations';
import { handleError } from '@/lib/errors';
import type { MintRWAInput, MintRWAResponse } from '@/types';
import { toast } from 'sonner';

// Custom validation: minFractionSize must be <= fractionCount
const validateMintData = (data: MintRWAInput): boolean => {
  if (data.minFractionSize > data.fractionCount) {
    toast.error('Minimum fraction size cannot exceed total fraction count');
    return false;
  }
  return true;
};

export type ProofStatus = 'idle' | 'generating' | 'ready' | 'error';

interface UseMintRWAReturn {
  mint: (data: MintRWAInput) => Promise<MintRWAResponse>;
  loading: boolean;
  proofStatus: ProofStatus;
  txHash: string | null;
  tokenId: number | null;
  error: Error | null;
  reset: () => void;
}

/**
 * Hook for minting RWA tokens with ZK proof generation
 * Handles the complete workflow: validation → proof generation → minting
 * @returns Mint function and state management
 */
export function useMintRWA(): UseMintRWAReturn {
  const [proofStatus, setProofStatus] = useState<ProofStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: MintRWAInput) => {
      // Step 1: Validate inputs using Zod schema
      try {
        mintRWASchema.parse(data);
      } catch (error) {
        if (error instanceof ZodError) {
          const errorMessage = error.issues[0]?.message || 'Validation failed';
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        throw error;
      }

      // Step 2: Custom validation
      if (!validateMintData(data)) {
        throw new Error('Validation failed');
      }

      // Step 3: Set proof generation status
      setProofStatus('generating');
      toast.info('⏳ Generating ZK proof and minting token (this may take 1-2 minutes)...');

      try {
        // Step 4: Call backend API to mint RWA
        const response = await mintRWA(data);

        // Step 5: Update proof status to ready
        setProofStatus('ready');
        toast.success('✓ ZK Proof generated successfully');

        // Step 6: Store transaction details
        setTxHash(response.txHash);
        setTokenId(response.tokenId);

        // Success notification
        toast.success(`RWA Token #${response.tokenId} minted successfully!`);

        return response;
      } catch (error) {
        // Step 7: Handle errors
        setProofStatus('error');
        throw error;
      }
    },
    onError: (error: Error) => {
      setProofStatus('error');
      console.error('Mint error:', error);
      // Toast already shown by API interceptor
    },
  });

  const reset = () => {
    setProofStatus('idle');
    setTxHash(null);
    setTokenId(null);
    mutation.reset();
  };

  return {
    mint: mutation.mutateAsync,
    loading: mutation.isPending,
    proofStatus,
    txHash,
    tokenId,
    error: mutation.error,
    reset,
  };
}

// Export validation schema for use in forms
export { mintRWASchema };
