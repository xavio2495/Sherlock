// ============ Asset Metadata Types ============

/**
 * AssetMetadata matches the Solidity struct returned by RWATokenFactory.getAssetMetadata()
 */
export interface AssetMetadata {
  issuer: string;
  documentHash: string;
  totalValue: bigint;
  fractionCount: bigint;
  availableFractions: bigint;
  minFractionSize: bigint;
  lockupPeriod: bigint;
  lockupEndTime: bigint;
  assetType: string;
  oraclePrice: bigint;
}

// ============ Mint RWA Types ============

export interface MintRWAInput {
  issuerAddress: string;
  documentHash: string;
  totalValue: number;
  fractionCount: number;
  minFractionSize: number;
  lockupPeriod: number;
  assetType: string;
  zkProofInput: {
    commitment: string;
    nullifier: string;
  };
}

export interface MintRWAResponse {
  success: boolean;
  tokenId: number;
  txHash: string;
  oraclePrice: number;
}

// ============ Purchase Fractions Types ============

export interface PurchaseInput {
  tokenId: number;
  amount: number;
  buyerAddress: string;
  zkProof: string;
}

export interface PurchaseResponse {
  success: boolean;
  txHash: string;
  totalCost: number;
}

// ============ ZK Proof Types ============

export interface ZKProofInput {
  proofType: 'eligibility' | 'range';
  userAddress: string;
  inputs: {
    commitment?: string;
    secret?: string;
    tokenId?: number;
    actualAmount?: number;
    minRange?: number;
    maxRange?: number;
  };
}

export interface ZKProofResponse {
  proof: string;
  publicSignals: string[];
}

// ============ Oracle Price Types ============

export interface PriceData {
  feedId: string;
  price: number;
  timestamp: number;
  confidence: number;
}

export interface OraclePricesResponse {
  prices: PriceData[];
}

// ============ Backend Asset Metadata Types ============

export interface AssetMetadataResponse {
  success: boolean;
  tokenId: number;
  metadata: {
    issuer: string;
    documentHash: string;
    totalValue: number;
    fractionCount: number;
    minFractionSize: number;
    mintTimestamp: number;
    oraclePriceAtMint: number;
    verified: boolean;
  };
  fractionSpec: {
    totalSupply: number;
    minUnitSize: number;
    lockupPeriod: number;
    lockupEnd: number;
    isActive: boolean;
  };
  economics: {
    pricePerFraction: string;
    availableFractions: number;
    soldFractions: number;
    availableValue: string;
    soldValue: string;
  };
}

export interface AssetWithBackendData {
  tokenId: number;
  issuer: `0x${string}`;
  documentHash: string;
  totalValue: number;
  fractionCount: number;
  minFractionSize: number;
  mintTimestamp: number;
  oraclePriceAtMint: number;
  verified: boolean;
  assetType: string;
  soldFractions: number;
  availableFractions: number;
  pricePerFraction: number;
  isActive: boolean;
  priceId: `0x${string}`; // Required for PurchaseModal compatibility
}

// ============ Error Types ============

export interface APIError {
  message: string;
  code?: string;
  details?: unknown;
}
