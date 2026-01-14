import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { config } from './config';

// Contract ABIs will be imported from compiled contracts
// For now, we'll use minimal ABIs for the functions we need

const RWA_FACTORY_ABI = [
  'function mintRWAToken(string memory documentHash, uint256 totalValue, uint256 fractionCount, uint256 minFractionSize, bytes32 priceId, bytes[] calldata priceUpdateData, uint256 lockupWeeks) external payable returns (uint256)',
  'function purchaseFraction(uint256 tokenId, uint256 amount, bytes32 secret, bytes32 nullifier) external payable',
  'function getAssetMetadata(uint256 tokenId) external view returns (tuple(address issuer, string documentHash, uint256 totalValue, uint256 fractionCount, uint256 minFractionSize, uint256 mintTimestamp, uint256 oraclePriceAtMint, bytes32 priceId, bool verified))',
];

const ZK_VERIFIER_ABI = [
  'function registerCommitment(bytes32 commitment) external',
  'function verifyEligibility(address user, bytes32 secret, bytes32 nullifier) external view returns (bool)',
  'function verifyRangeProof(uint256 tokenId, address holder, uint256 minRange, uint256 maxRange, bytes memory proof) external view returns (bool)',
];

const PYTH_ORACLE_READER_ABI = [
  'function updatePrice(bytes32 priceId, bytes[] calldata priceUpdateData) external payable',
  'function getLatestPrice(bytes32 priceId) external view returns (int64 price, uint64 timestamp)',
  'function getPriceAtMint(uint256 tokenId) external view returns (int64)',
  'function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)',
];

const FRACTION_MANAGER_ABI = [
  'function isTransferAllowed(uint256 tokenId, uint256 amount) external view returns (bool)',
  'function recombineFractions(uint256 tokenId, uint256 amount) external',
];

const YIELD_CALCULATOR_ABI = [
  'function calculateYield(uint256 tokenId, uint256 principalAmount, uint256 durationDays) external view returns (uint256)',
  'function previewTokenValue(uint256 tokenId) external view returns (uint256)',
];

export class ContractService {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  public contracts: {
    rwaFactory: Contract;
    zkVerifier: Contract;
    pythOracleReader: Contract;
    fractionManager: Contract;
    yieldCalculator: Contract;
  };

  constructor() {
    // Configure network explicitly to avoid auto-detection
    const network = ethers.Network.from({
      name: 'mantle-sepolia',
      chainId: config.chainId,
    });

    // Create provider with custom options
    this.provider = new ethers.JsonRpcProvider(
      config.rpcUrl,
      network,
      {
        staticNetwork: network,
      }
    );

    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    // Initialize contract instances
    this.contracts = {
      rwaFactory: new ethers.Contract(
        config.contracts.rwaFactory,
        RWA_FACTORY_ABI,
        this.wallet
      ),
      zkVerifier: new ethers.Contract(
        config.contracts.zkVerifier,
        ZK_VERIFIER_ABI,
        this.wallet
      ),
      pythOracleReader: new ethers.Contract(
        config.contracts.pythOracleReader,
        PYTH_ORACLE_READER_ABI,
        this.wallet
      ),
      fractionManager: new ethers.Contract(
        config.contracts.fractionManager,
        FRACTION_MANAGER_ABI,
        this.wallet
      ),
      yieldCalculator: new ethers.Contract(
        config.contracts.yieldCalculator,
        YIELD_CALCULATOR_ABI,
        this.wallet
      ),
    };
  }

  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || ethers.parseUnits('1', 'gwei');
  }

  async estimateGas(tx: any): Promise<bigint> {
    try {
      return await this.provider.estimateGas(tx);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return BigInt(500000); // Fallback gas limit
    }
  }

  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  getWallet(): Wallet {
    return this.wallet;
  }
}

export const contractService = new ContractService();
