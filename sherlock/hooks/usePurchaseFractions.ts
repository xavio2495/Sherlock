'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseFractions, generateZKProof } from '@/lib/api';
import { purchaseSchema, type PurchaseFormData } from '@/lib/validations';
import { handleError } from '@/lib/errors';
import { PurchaseInput, PurchaseResponse } from '@/types';
import { toast } from 'sonner';

export type ProofStatus = 'idle' | 'generating' | 'ready' | 'complete' | 'error';

export function usePurchaseFractions() {
  const queryClient = useQueryClient();
  const [proofStatus, setProofStatus] = useState<ProofStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  const mutation = useMutation<PurchaseResponse, Error, PurchaseFormData>({
    mutationFn: async (data: PurchaseFormData) => {
      // Step 1: Validate input
      const validatedData = purchaseSchema.parse(data);

      // Step 2: Generate ZK proof for buyer eligibility
      setProofStatus('generating');
      toast.info('⏳ Generating ZK eligibility proof...');

      const proofResponse = await generateZKProof({
        proofType: 'eligibility',
        userAddress: validatedData.buyerAddress,
        inputs: {
          tokenId: validatedData.tokenId,
          commitment: `0x${Math.random().toString(16).substring(2)}`, // Mock commitment
          secret: `0x${Math.random().toString(16).substring(2)}`, // Mock secret
        },
      });

      // Step 3: Proof is ready
      setProofStatus('ready');
      toast.success('✓ ZK proof generated');

      // Step 4: Call backend API to purchase fractions
      const purchaseInput: PurchaseInput = {
        tokenId: validatedData.tokenId,
        amount: validatedData.amount,
        buyerAddress: validatedData.buyerAddress,
        zkProof: proofResponse.proof,
      };

      const response = await purchaseFractions(purchaseInput);

      // Step 5: Store transaction hash
      setTxHash(response.txHash);
      setProofStatus('complete');

      return response;
    },
    onSuccess: (data) => {
      // Invalidate marketplace data to refetch updated asset availability
      queryClient.invalidateQueries({ queryKey: ['assets'] });

      toast.success('Purchase successful!', {
        description: `Transaction hash: ${data.txHash.slice(0, 10)}...`,
      });
    },
    onError: (error) => {
      setProofStatus('error');
      toast.error('Purchase failed', {
        description: error.message || 'An error occurred during the purchase',
      });
    },
  });

  const reset = () => {
    setProofStatus('idle');
    setTxHash(null);
    mutation.reset();
  };

  return {
    purchase: mutation.mutate,
    purchaseAsync: mutation.mutateAsync,
    loading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    proofStatus,
    txHash,
    reset,
  };
}
