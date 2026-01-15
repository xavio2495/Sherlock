import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { ZKProofRequest, ZKProofResponse, APIError } from '../types';
import Logger from '../utils/logger';

const logger = new Logger('Prover');

/**
 * ZK Proof Generator using SnarkJS
 * Generates Groth16 proofs for eligibility and range proofs
 */

interface CircuitArtifacts {
  wasmPath: string;
  zkeyPath: string;
  vkeyPath: string;
}

interface CachedCircuit {
  wasm: Buffer;
  zkey: any;
  vkey: any;
}

// Circuit paths configuration
const CIRCUITS_DIR = path.join(__dirname, '../../circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const KEYS_DIR = path.join(CIRCUITS_DIR, 'keys');

const CIRCUITS: Record<string, CircuitArtifacts> = {
  eligibility: {
    wasmPath: path.join(BUILD_DIR, 'eligibility_js', 'eligibility.wasm'),
    zkeyPath: path.join(KEYS_DIR, 'eligibility_final.zkey'),
    vkeyPath: path.join(KEYS_DIR, 'eligibility_verification_key.json'),
  },
  rangeProof: {
    wasmPath: path.join(BUILD_DIR, 'rangeProof_js', 'rangeProof.wasm'),
    zkeyPath: path.join(KEYS_DIR, 'rangeProof_final.zkey'),
    vkeyPath: path.join(KEYS_DIR, 'rangeProof_verification_key.json'),
  },
};

// Circuit cache for performance
const circuitCache: Record<string, CachedCircuit> = {};

// Poseidon hasher instance
let poseidon: any = null;

/**
 * Initialize Poseidon hasher
 */
async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
    logger.info('Poseidon hasher initialized');
  }
  return poseidon;
}

/**
 * Load circuit artifacts (WASM + proving key)
 * Caches in memory for performance
 */
async function loadCircuit(circuitName: string): Promise<CachedCircuit> {
  // Return cached if available
  if (circuitCache[circuitName]) {
    logger.info(`Using cached circuit: ${circuitName}`);
    return circuitCache[circuitName];
  }

  const artifacts = CIRCUITS[circuitName];
  if (!artifacts) {
    throw new APIError(400, `Unknown circuit: ${circuitName}`);
  }

  // Check if files exist
  if (!existsSync(artifacts.wasmPath)) {
    throw new APIError(
      500,
      `Circuit WASM not found: ${artifacts.wasmPath}. Run ./scripts/setup-circuits.sh`
    );
  }

  if (!existsSync(artifacts.zkeyPath)) {
    throw new APIError(
      500,
      `Proving key not found: ${artifacts.zkeyPath}. Run ./scripts/setup-circuits.sh`
    );
  }

  logger.info(`Loading circuit: ${circuitName}`);

  // Load artifacts
  const wasm = readFileSync(artifacts.wasmPath);
  const zkey = readFileSync(artifacts.zkeyPath);
  const vkey = JSON.parse(readFileSync(artifacts.vkeyPath, 'utf-8'));

  // Cache for future use
  circuitCache[circuitName] = { wasm, zkey, vkey };

  logger.info(`Circuit loaded and cached: ${circuitName}`);
  return circuitCache[circuitName];
}

/**
 * Convert string to BigInt using keccak256 hash
 * This allows arbitrary strings to be used as ZK inputs
 */
function stringToBigInt(str: string): bigint {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = Buffer.from(data);
  // Use first 31 bytes to stay within field bounds
  const hex = '0x' + hashBuffer.toString('hex').slice(0, 62);
  return BigInt(hex);
}

/**
 * Compute Poseidon hash commitment
 * Used for generating commitments to secrets or amounts
 */
export async function computeCommitment(inputs: string[] | number[]): Promise<string> {
  const hash = await initPoseidon();
  
  // Convert inputs to BigInts
  const bigIntInputs = inputs.map((input) => {
    if (typeof input === 'string') {
      // Convert string to BigInt via hash
      return stringToBigInt(input);
    } else {
      return BigInt(input);
    }
  });
  
  // Compute Poseidon hash
  const commitment = hash(bigIntInputs);
  
  // Convert to string (decimal format)
  return hash.F.toString(commitment);
}

/**
 * Generate eligibility proof
 * Proves knowledge of (secret, nullifier) that produce a specific commitment
 * 
 * @param secret - User's secret credential
 * @param nullifier - Unique identifier (prevents double-spending)
 * @returns Groth16 proof + public signals (commitment)
 */
export async function generateEligibilityProof(
  secret: string,
  nullifier: string
): Promise<ZKProofResponse> {
  try {
    logger.info('Generating eligibility proof');

    // Load circuit
    const circuit = await loadCircuit('eligibility');

    // Compute expected commitment
    const commitment = await computeCommitment([secret, nullifier]);
    logger.info(`Computed commitment: ${commitment}`);

    // Prepare circuit inputs - convert strings to BigInt format
    const inputs = {
      secret: stringToBigInt(secret).toString(),
      nullifier: stringToBigInt(nullifier).toString(),
    };

    logger.info('Generating witness...');

    // Generate witness (compute circuit with inputs)
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      circuit.wasm,
      circuit.zkey
    );

    logger.info('Witness generated, creating proof...');

    // Verify commitment matches
    if (publicSignals[0] !== commitment) {
      throw new APIError(500, 'Commitment mismatch in proof generation');
    }

    // Verify proof locally before returning
    const vkey = circuit.vkey;
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (!isValid) {
      throw new APIError(500, 'Generated proof failed verification');
    }

    logger.info('Eligibility proof generated and verified successfully');

    // Serialize proof for on-chain verification
    const proofCalldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

    return {
      success: true,
      proof: JSON.stringify(proof),
      publicSignals: publicSignals.map((s: any) => s.toString()),
      commitment: commitment,
      solidityCalldata: proofCalldata,
    };
  } catch (error: any) {
    logger.error('Failed to generate eligibility proof', error);
    throw new APIError(500, `Proof generation failed: ${error.message}`);
  }
}

/**
 * Generate range proof
 * Proves that actualAmount ∈ [minRange, maxRange] without revealing actualAmount
 * 
 * @param actualAmount - The actual value (kept private)
 * @param minRange - Minimum claimed range (public)
 * @param maxRange - Maximum claimed range (public)
 * @param commitment - Optional pre-computed commitment, will compute if not provided
 * @returns Groth16 proof + public signals
 */
export async function generateRangeProof(
  actualAmount: number,
  minRange: number,
  maxRange: number,
  commitment?: string
): Promise<ZKProofResponse> {
  try {
    logger.info(`Generating range proof: ${minRange} <= amount <= ${maxRange}`);

    // Validate inputs
    if (actualAmount < minRange || actualAmount > maxRange) {
      throw new APIError(
        400,
        `Invalid range: actualAmount ${actualAmount} not in [${minRange}, ${maxRange}]`
      );
    }

    if (minRange < 0 || maxRange < 0) {
      throw new APIError(400, 'Range values must be non-negative');
    }

    // Load circuit
    const circuit = await loadCircuit('rangeProof');

    // Compute commitment to actualAmount if not provided
    const computedCommitment = commitment || (await computeCommitment([actualAmount]));
    logger.info(`Using commitment: ${computedCommitment}`);

    // Prepare circuit inputs
    const inputs = {
      actualAmount: actualAmount.toString(),
      minRange: minRange.toString(),
      maxRange: maxRange.toString(),
      commitment: computedCommitment,
    };

    logger.info('Generating witness...');

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      circuit.wasm,
      circuit.zkey
    );

    logger.info('Witness generated, creating proof...');

    // Verify proof locally
    const vkey = circuit.vkey;
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (!isValid) {
      throw new APIError(500, 'Generated proof failed verification');
    }

    logger.info('Range proof generated and verified successfully');

    // Serialize proof
    const proofCalldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

    return {
      success: true,
      proof: JSON.stringify(proof),
      publicSignals: publicSignals.map((s: any) => s.toString()),
      commitment: computedCommitment,
      solidityCalldata: proofCalldata,
    };
  } catch (error: any) {
    logger.error('Failed to generate range proof', error);
    throw new APIError(500, `Proof generation failed: ${error.message}`);
  }
}

/**
 * Main proof generation handler
 * Routes to appropriate proof generator based on proofType
 */
export async function generateProof(request: ZKProofRequest): Promise<ZKProofResponse> {
  const { proofType, inputs } = request;

  logger.info(`Proof generation requested: ${proofType}`);

  switch (proofType) {
    case 'eligibility':
      if (!inputs.secret || !inputs.nullifier) {
        throw new APIError(400, 'Missing required inputs: secret, nullifier');
      }
      return generateEligibilityProof(inputs.secret, inputs.nullifier);

    case 'range':
      if (
        inputs.actualAmount === undefined ||
        inputs.minRange === undefined ||
        inputs.maxRange === undefined
      ) {
        throw new APIError(400, 'Missing required inputs: actualAmount, minRange, maxRange');
      }
      return generateRangeProof(
        inputs.actualAmount,
        inputs.minRange,
        inputs.maxRange,
        inputs.commitment
      );

    default:
      throw new APIError(400, `Unknown proof type: ${proofType}`);
  }
}

/**
 * Utility: Check if circuits are compiled and ready
 */
export function areCircuitsReady(): boolean {
  for (const [name, artifacts] of Object.entries(CIRCUITS)) {
    if (!existsSync(artifacts.wasmPath) || !existsSync(artifacts.zkeyPath)) {
      logger.warn(`Circuit not ready: ${name}`);
      return false;
    }
  }
  return true;
}

/**
 * Utility: Get circuit status
 */
export function getCircuitStatus() {
  const status: Record<string, any> = {};
  
  for (const [name, artifacts] of Object.entries(CIRCUITS)) {
    status[name] = {
      wasm: existsSync(artifacts.wasmPath),
      zkey: existsSync(artifacts.zkeyPath),
      vkey: existsSync(artifacts.vkeyPath),
      cached: !!circuitCache[name],
    };
  }
  
  return status;
}

// Export as object for backward compatibility
export const zkProver = {
  generateProof,
  generateEligibilityProof,
  generateRangeProof,
  computeCommitment,
  areCircuitsReady,
  getCircuitStatus,
};

