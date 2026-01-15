// Contract ABIs - these should be generated from Solidity contracts and placed in /public/abis/
import RWATokenFactoryABI from '@/public/abis/RWATokenFactory.json';
import ZKVerifierABI from '@/public/abis/ZKVerifier.json';
import PythOracleReaderABI from '@/public/abis/PythOracleReader.json';

// TypeScript types for contract addresses
export type ContractAddress = `0x${string}`;

// Contract configuration
export const CONTRACTS = {
  RWATokenFactory: {
    address: '0xeA157DE7D1ec58a0610D82171bbb4873bc19319B' as ContractAddress,
    abi: RWATokenFactoryABI,
  },
  ZKVerifier: {
    address: '0xE504B6FB1BE655164a5EF14CCa5822ED7d3305ef' as ContractAddress,
    abi: ZKVerifierABI,
  },
  PythOracleReader: {
    address: '0xD78e55b27D452c07a0D19A500F3d67E2B5754478' as ContractAddress,
    abi: PythOracleReaderABI,
  },
} as const;

// Pyth price feed IDs
export const PYTH_PRICE_IDS = {
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' as `0x${string}`,
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' as `0x${string}`,
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a' as `0x${string}`,
} as const;

// Helper function to get contract config
export function getContractConfig(contractName: keyof typeof CONTRACTS) {
  const contract = CONTRACTS[contractName];
  if (!contract.address) {
    throw new Error(`Contract address for ${contractName} is not set`);
  }
  return {
    address: contract.address,
    abi: contract.abi,
  };
}

// TypeScript types for Solidity structs

export interface AssetMetadata {
  issuer: `0x${string}`;
  documentHash: string;
  totalValue: bigint;
  fractionCount: bigint;
  minFractionSize: bigint;
  mintTimestamp: bigint;
  oraclePriceAtMint: bigint;
  priceId: `0x${string}`;
  verified: boolean;
  assetType?: string; // Optional for compatibility
}

// Extended type for marketplace usage with transformed values
export interface AssetWithId {
  tokenId: number;
  issuer: `0x${string}`;
  documentHash: string;
  totalValue: number; // Converted from bigint
  fractionCount: number; // Converted from bigint
  minFractionSize: number; // Converted from bigint
  mintTimestamp: number; // Converted from bigint
  oraclePriceAtMint: number; // Converted from bigint
  priceId: `0x${string}`;
  verified: boolean;
  assetType: string;
  soldFractions: number; // Calculated or fetched
}

export interface PriceData {
  price: bigint;
  timestamp: bigint;
  confidence: bigint;
  expo: number;
  isValid: boolean;
}
