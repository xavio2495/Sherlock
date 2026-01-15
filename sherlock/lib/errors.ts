import { AxiosError } from 'axios';
import { ZodError } from 'zod';

// ============================================
// Custom Error Classes
// ============================================

/**
 * Error thrown when contract interaction fails
 */
export class ContractError extends Error {
  constructor(
    message: string,
    public code?: string,
    public txHash?: string
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

/**
 * Error thrown when ZK proof generation or verification fails
 */
export class ProofError extends Error {
  constructor(
    message: string,
    public proofType?: 'eligibility' | 'range'
  ) {
    super(message);
    this.name = 'ProofError';
  }
}

/**
 * Error thrown when network/API requests fail
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// ============================================
// Error Handler Function
// ============================================

/**
 * Central error handler that converts various error types to user-friendly messages
 * @param error - The error object to handle
 * @returns User-friendly error message string
 */
export function handleError(error: unknown): string {
  // Log error for debugging
  console.error('[Error Handler]:', error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const firstError = error.issues[0];
    return firstError?.message || 'Validation failed. Please check your inputs.';
  }

  // Handle custom error classes
  if (error instanceof ContractError) {
    return `Contract Error: ${error.message}${error.txHash ? ` (Tx: ${error.txHash.slice(0, 10)}...)` : ''}`;
  }

  if (error instanceof ProofError) {
    return `ZK Proof Error: ${error.message}`;
  }

  if (error instanceof NetworkError) {
    if (error.statusCode === 404) {
      return 'Resource not found. Please try again.';
    }
    if (error.statusCode === 500) {
      return 'Server error. Please try again later.';
    }
    return `Network Error: ${error.message}`;
  }

  // Handle Axios errors (API calls)
  if (error instanceof AxiosError) {
    if (error.code === 'ERR_NETWORK') {
      return 'Backend server is not running. Please start the backend with: cd backend && npm run dev';
    }
    if (error.response) {
      const message = error.response.data?.message || error.response.data?.error;
      return message || `API Error: ${error.response.status} ${error.response.statusText}`;
    }
    if (error.request) {
      return 'No response from server. Check your internet connection.';
    }
    return `Request Error: ${error.message}`;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Map common blockchain/Web3 errors
    if (error.message.includes('user rejected')) {
      return 'Transaction rejected by user.';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction. Please add more MNT to your wallet.';
    }
    if (error.message.includes('nonce')) {
      return 'Transaction nonce error. Please try again.';
    }
    if (error.message.includes('gas')) {
      return 'Gas estimation failed. Transaction may fail.';
    }
    return error.message;
  }

  // Handle unknown error types
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

// ============================================
// Error Mapping Utilities
// ============================================

/**
 * Map contract revert reasons to user-friendly messages
 */
export function mapContractError(revertReason: string): string {
  const errorMap: Record<string, string> = {
    'Insufficient balance': 'You do not have enough fractions to complete this transaction.',
    'Asset not found': 'This RWA asset does not exist.',
    'Lockup period active': 'This asset is still in its lockup period and cannot be traded.',
    'Invalid proof': 'Zero-knowledge proof verification failed. Please try again.',
    'Fractions sold out': 'All fractions for this asset have been sold.',
    'Below minimum size': 'Purchase amount is below the minimum fraction size.',
    Unauthorized: 'You are not authorized to perform this action.',
  };

  for (const [key, message] of Object.entries(errorMap)) {
    if (revertReason.includes(key)) {
      return message;
    }
  }

  return `Contract Error: ${revertReason}`;
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return error.statusCode !== 404 && error.statusCode !== 401;
  }

  if (error instanceof AxiosError) {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.response?.status === 503 ||
      error.response?.status === 504
    );
  }

  return false;
}

/**
 * Get appropriate retry delay based on error type
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
  return Math.min(1000 * Math.pow(2, attemptNumber), 10000);
}
