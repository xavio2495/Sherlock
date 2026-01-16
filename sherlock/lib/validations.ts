import { z } from 'zod';

// ============================================
// Mint RWA Validation Schema
// ============================================

export const mintRWASchema = z
  .object({
    issuerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    documentHash: z
      .string()
      .length(66, 'Document hash must be 66 characters (0x + 64 hex)')
      .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid document hash format'),
    totalValue: z
      .number()
      .int('Total value must be an integer')
      .min(1, 'Total value must be at least 1')
      .max(1000000, 'Total value cannot exceed $10,000 (1,000,000 cents)'),
    fractionCount: z
      .number()
      .int('Fraction count must be an integer')
      .min(1, 'Fraction count must be at least 1')
      .max(10000, 'Fraction count cannot exceed 10,000'),
    minFractionSize: z
      .number()
      .int('Minimum fraction size must be an integer')
      .min(1, 'Minimum fraction size must be at least 1'),
    lockupPeriod: z
      .number()
      .int('Lockup period must be an integer')
      .min(0, 'Lockup period cannot be negative'),
    assetType: z.enum(['Invoice', 'Bond', 'Real Estate'], {
      message: 'Asset type must be Invoice, Bond, or Real Estate',
    }),
    zkProofInput: z.object({
      commitment: z.string().min(1, 'Commitment is required'),
      nullifier: z.string().min(1, 'Nullifier is required'),
    }),
  })
  .refine((data) => data.minFractionSize <= data.fractionCount, {
    message: 'Minimum fraction size cannot exceed total fraction count',
    path: ['minFractionSize'],
  });

export type MintRWAFormData = z.infer<typeof mintRWASchema>;

// ============================================
// Purchase Fractions Validation Schema Factory
// ============================================

/**
 * Creates a purchase validation schema with dynamic max validation
 * @param availableFractions - Maximum fractions available for purchase
 * @param minFractionSize - Minimum fractions that must be purchased
 * @returns Zod schema for purchase form validation
 */
export function createPurchaseSchema(availableFractions: number, minFractionSize: number = 1) {
  return z.object({
    tokenId: z.number().int().min(0, 'Invalid token ID'),
    amount: z
      .number()
      .int('Amount must be an integer')
      .min(minFractionSize, `Amount must be at least ${minFractionSize}`)
      .max(availableFractions, `Cannot exceed ${availableFractions} available fractions`),
    buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  });
}

// Base purchase schema (without dynamic validation)
export const purchaseSchema = z.object({
  tokenId: z.number().int().min(0, 'Invalid token ID'),
  amount: z.number().int().min(1, 'Amount must be at least 1'),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

export type PurchaseFormData = z.infer<typeof purchaseSchema>;

// ============================================
// General Validation Helpers
// ============================================

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate document hash format (0x + 64 hex chars)
 */
export function isValidDocumentHash(hash: string): boolean {
  return hash.length === 66 && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate amount is within range
 */
export function isValidAmount(
  amount: number,
  min: number,
  max: number
): { valid: boolean; error?: string } {
  if (amount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }
  if (amount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` };
  }
  return { valid: true };
}
