import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  MintRWAInput,
  MintRWAResponse,
  PurchaseInput,
  PurchaseResponse,
  ZKProofInput,
  ZKProofResponse,
  OraclePricesResponse,
} from '@/types';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 second timeout (2 minutes) for blockchain transactions
});

// Request interceptor for adding authentication
api.interceptors.request.use(
  (config) => {
    // Future: Add wallet signature for authentication
    // const signature = await signMessage();
    // config.headers.Authorization = `Bearer ${signature}`;
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Log error to console
    //console.log('API Error:', error.response?.data || error.message);

    // Handle different error scenarios
    let errorMessage = 'An unexpected error occurred';

    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - please try again';
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Backend server not running. Start it with: cd backend && npm run dev';
      console.warn('💡 Tip: The backend API server needs to be running on http://localhost:3001');
    } else if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          errorMessage = data?.message || 'Invalid request data';
          break;
        case 401:
          errorMessage = 'Unauthorized - please connect your wallet';
          break;
        case 403:
          errorMessage = 'Access forbidden';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 500:
          errorMessage = 'Server error - please try again later';
          break;
        default:
          errorMessage = data?.message || 'An error occurred';
      }
    } else if (error.request) {
      // Request made but no response
      errorMessage =
        "Backend server not responding. Make sure it's running on http://localhost:3001";
      console.warn('💡 Tip: Start the backend with: cd backend && npm run dev');
    }

    // Show toast notification
    toast.error(errorMessage, {
      duration: 5000, // Show for 5 seconds for better visibility
    });

    return Promise.reject(error);
  }
);

// ============ API Functions ============

/**
 * Mint a new RWA token
 * Note: This can take 60-90 seconds on Mantle Testnet due to transaction confirmation time
 */
export async function mintRWA(data: MintRWAInput): Promise<MintRWAResponse> {
  // Use extended timeout for minting (which includes ZK proof generation + blockchain tx)
  const response = await api.post<MintRWAResponse>('/rwa/create', data, {
    timeout: 180000, // 3 minutes for minting specifically
  });
  return response.data;
}

/**
 * Purchase fractions of an RWA token
 */
export async function purchaseFractions(data: PurchaseInput): Promise<PurchaseResponse> {
  const response = await api.post<PurchaseResponse>('/rwa/purchase', data);
  return response.data;
}

/**
 * Generate a ZK proof (eligibility or range proof)
 */
export async function generateZKProof(data: ZKProofInput): Promise<ZKProofResponse> {
  const response = await api.post<ZKProofResponse>('/zk/generate-proof', data);
  return response.data;
}

/**
 * Get current oracle prices for all supported feeds
 */
export async function getOraclePrices(): Promise<OraclePricesResponse> {
  const response = await api.get<OraclePricesResponse>('/oracle/prices');
  return response.data;
}

/**
 * Get asset metadata for a specific RWA token from backend
 * Includes on-chain metadata, fraction specs, and economics
 */
export async function getAssetMetadata(tokenId: number) {
  const response = await api.get(`/rwa/${tokenId}`);
  return response.data;
}

/**
 * Get metadata for all minted RWA tokens
 * Fetches metadata for token IDs 1 through maxTokenId
 */
export async function getAllAssets() {
  // First, try to get tokens 1-20 and filter out non-existent ones
  const promises = Array.from({ length: 20 }, (_, i) => 
    getAssetMetadata(i + 1).catch(() => null)
  );
  const results = await Promise.all(promises);
  return results.filter((result): result is NonNullable<typeof result> => 
    result !== null && result.success === true
  );
}

// Export the axios instance for custom requests
export default api;
