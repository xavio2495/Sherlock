'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PriceData } from '@/types';
import { formatDistance } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface OraclePriceWidgetProps {
  data: PriceData;
  icon: React.ReactNode;
  symbol: string;
  change24h?: number; // Optional 24h change percentage
}

export function OraclePriceWidget({ data, icon, symbol, change24h }: OraclePriceWidgetProps) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(data.price);

  const formattedConfidence = data.confidence ? `±$${data.confidence.toFixed(2)}` : 'N/A';

  const timeAgo = formatDistance(new Date(data.timestamp * 1000), new Date(), {
    addSuffix: true,
  });

  const isPositiveChange = change24h !== undefined && change24h >= 0;

  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
      {/* Live indicator */}
      <div className="absolute top-4 right-4">
        <Badge variant="outline" className="gap-1.5 bg-green-50 border-green-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-green-700">Live</span>
        </Badge>
      </div>

      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="shrink-0">{icon}</div>

          {/* Price Info */}
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">{symbol}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formattedPrice}</p>

            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-gray-400">Updated {timeAgo}</p>
              {data.confidence > 0 && (
                <>
                  <span className="text-xs text-gray-300">•</span>
                  <p className="text-xs text-gray-500">Confidence: {formattedConfidence}</p>
                </>
              )}
            </div>

            {/* 24h Change (if available) */}
            {change24h !== undefined && (
              <div className="mt-3">
                <Badge variant={isPositiveChange ? 'default' : 'destructive'} className="gap-1">
                  {isPositiveChange ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {isPositiveChange ? '+' : ''}
                    {change24h.toFixed(2)}%
                  </span>
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
