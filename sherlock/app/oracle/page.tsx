'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OraclePriceWidget } from '@/components/shared/OraclePriceWidget';
import { useOraclePrices } from '@/hooks/useOraclePrices';
import { AlertCircle, Bitcoin, DollarSign } from 'lucide-react';
import { PYTH_PRICE_IDS } from '@/lib/contracts';

// Ethereum icon component (since lucide doesn't have one)
function EthereumIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 417"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
    >
      <path fill="#343434" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
      <path fill="#8C8C8C" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
      <path fill="#3C3C3B" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" />
      <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
      <path fill="#141414" d="M127.961 287.958l127.96-75.637-127.96-58.162z" />
      <path fill="#393939" d="M0 212.32l127.96 75.638v-133.8z" />
    </svg>
  );
}

export default function OraclePage() {
  const { data, isLoading, error, isError } = useOraclePrices();

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Oracle Price Feeds</h1>
          <p className="text-gray-600">Real-time cryptocurrency prices powered by Pyth Network</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Oracle Price Feeds</h1>
          <p className="text-gray-600">Real-time cryptocurrency prices powered by Pyth Network</p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to fetch prices</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : 'An error occurred while fetching oracle prices. Retrying...'}
          </AlertDescription>
        </Alert>

        {/* Show skeleton while retrying */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Find specific price feeds
  const ethPrice = data.prices.find((p) => p.feedId === PYTH_PRICE_IDS.ETH_USD);
  const btcPrice = data.prices.find((p) => p.feedId === PYTH_PRICE_IDS.BTC_USD);
  const usdcPrice = data.prices.find((p) => p.feedId === PYTH_PRICE_IDS.USDC_USD);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Oracle Price Feeds</h1>
        <p className="text-gray-600">Real-time cryptocurrency prices powered by Pyth Network</p>
        <p className="text-sm text-gray-500 mt-1">Auto-refreshes every 30 seconds</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* ETH/USD Widget */}
        {ethPrice && (
          <OraclePriceWidget
            data={ethPrice}
            symbol="ETH/USD"
            icon={<EthereumIcon className="w-12 h-12" />}
          />
        )}

        {/* BTC/USD Widget */}
        {btcPrice && (
          <OraclePriceWidget
            data={btcPrice}
            symbol="BTC/USD"
            icon={<Bitcoin className="w-12 h-12 text-orange-500" />}
          />
        )}

        {/* USDC/USD Widget */}
        {usdcPrice && (
          <OraclePriceWidget
            data={usdcPrice}
            symbol="USDC/USD"
            icon={<DollarSign className="w-12 h-12 text-blue-500" />}
          />
        )}
      </div>

      {/* Informational section */}
      <div className="mt-12 p-6 bg-purple-50 border border-purple-200 rounded-lg">
        <h2 className="text-lg font-semibold text-purple-900 mb-2">About Pyth Network Oracles</h2>
        <p className="text-sm text-purple-700">
          Pyth Network provides high-fidelity financial market data to smart contracts. These price
          feeds are used by the Sherlock RWA platform to ensure accurate valuations during asset
          tokenization and trading. Confidence intervals represent the uncertainty in each price
          measurement.
        </p>
      </div>
    </div>
  );
}
