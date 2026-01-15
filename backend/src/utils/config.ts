import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export const config: AppConfig = {
  port: parseInt(getEnvVar('PORT', '3001'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  rpcUrl: getEnvVar('MANTLE_RPC_URL'),
  chainId: parseInt(getEnvVar('CHAIN_ID', '5003'), 10),
  privateKey: getEnvVar('PRIVATE_KEY'),
  
  contracts: {
    zkVerifier: getEnvVar('CONTRACT_ADDRESS_ZK_VERIFIER'),
    pythOracleReader: getEnvVar('CONTRACT_ADDRESS_PYTH_ORACLE_READER'),
    fractionManager: getEnvVar('CONTRACT_ADDRESS_FRACTION_MANAGER'),
    rwaFactory: getEnvVar('CONTRACT_ADDRESS_RWA_FACTORY'),
    yieldCalculator: getEnvVar('CONTRACT_ADDRESS_YIELD_CALCULATOR'),
    pythContract: getEnvVar('PYTH_CONTRACT_ADDRESS'),
  },

  pyth: {
    apiUrl: getEnvVar('PYTH_API_URL'),
    priceFeeds: {
      ethUsd: getEnvVar('PRICE_FEED_ETH_USD'),
      btcUsd: getEnvVar('PRICE_FEED_BTC_USD'),
      usdcUsd: getEnvVar('PRICE_FEED_USDC_USD'),
    },
  },

  oracle: {
    updateIntervalMs: parseInt(getEnvVar('ORACLE_UPDATE_INTERVAL_MS', '300000'), 10),
    autoUpdateEnabled: getEnvVar('ORACLE_AUTO_UPDATE_ENABLED', 'false') === 'true',
  },
};

export default config;
