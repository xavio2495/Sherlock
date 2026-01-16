// Types for Sherlock RWA Platform Backend

// ============ RWA Types ============

export interface RWACreateRequest {
  issuerAddress: string;
  documentHash: string;
  totalValue: number;
  fractionCount: number;
  minFractionSize: number;
  lockupPeriod: number;
  assetType: 'invoice' | 'bond' | 'real-estate';
  zkProofInput: {
    commitment: string;
    secret: string;
    nullifier: string;
  };
}

export interface RWACreateResponse {
  success: boolean;
  tokenId?: number;
  txHash?: string;
  oraclePrice?: number;
  zkProof?: string;
  error?: string;
}

// ============ ZK Proof Types ============

export type ProofType = 'eligibility' | 'range';

export interface ZKProofRequest {
  proofType: ProofType;
  userAddress: string;
  inputs: ZKProofInputs;
}

export interface ZKProofInputs {
  commitment?: string;
  secret?: string;
  nullifier?: string;
  // For range proofs
  tokenId?: number;
  actualAmount?: number;
  minRange?: number;
  maxRange?: number;
}

export interface ZKProofResponse {
  success: boolean;
  commitment?: string;
  proof?: string;
  publicSignals?: string[];
  solidityCalldata?: string;
  error?: string;
}

// ============ Oracle Types ============

export interface PriceData {
  feedId: string;
  price: number;
  timestamp: number;
  confidence: number;
  expo: number;
}

export interface OraclePriceResponse {
  success: boolean;
  prices?: PriceData[];
  error?: string;
}

export interface OracleUpdateRequest {
  priceIds: string[];
}

export interface OracleUpdateResponse {
  success: boolean;
  txHash?: string;
  txHashes?: string[];
  updatedFeeds?: string[];
  error?: string;
}

// ============ Purchase Types ============

export interface PurchaseRequest {
  tokenId: number;
  amount: number;
  buyerAddress: string;
  zkProofInput: {
    commitment: string;
    secret: string;
    nullifier: string;
  };
}

export interface PurchaseResponse {
  success: boolean;
  txHash?: string;
  totalCost?: number;
  currentPrice?: number;
  error?: string;
}

// ============ Contract Types ============

export interface ContractAddresses {
  zkVerifier: string;
  pythOracleReader: string;
  fractionManager: string;
  rwaFactory: string;
  yieldCalculator: string;
  pythContract: string;
}

export interface AssetMetadata {
  issuer: string;
  documentHash: string;
  totalValue: bigint;
  fractionCount: bigint;
  minFractionSize: bigint;
  mintTimestamp: bigint;
  oraclePriceAtMint: bigint;
  priceId: string;
  verified: boolean;
}

// ============ Error Types ============

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ============ Config Types ============

export interface AppConfig {
  port: number;
  nodeEnv: string;
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contracts: ContractAddresses;
  pyth: {
    apiUrl: string;
    priceFeeds: {
      ethUsd: string;
      btcUsd: string;
      usdcUsd: string;
    };
  };
  oracle: {
    updateIntervalMs: number;
    autoUpdateEnabled: boolean;
  };
}
