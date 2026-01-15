'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface FractionCalculatorProps {
  totalValue: number;
  fractionCount: number;
  minFractionSize: number;
  onAmountChange: (amount: number) => void;
}

export function FractionCalculator({
  totalValue,
  fractionCount,
  minFractionSize,
  onAmountChange,
}: FractionCalculatorProps) {
  const [dollarAmount, setDollarAmount] = useState('');

  const pricePerFraction = totalValue / fractionCount;
  const calculatedFractions = Math.floor(Number(dollarAmount) / pricePerFraction);
  const showWarning = calculatedFractions > 0 && calculatedFractions < minFractionSize;

  useEffect(() => {
    if (calculatedFractions >= minFractionSize) {
      onAmountChange(calculatedFractions);
    } else if (calculatedFractions > 0) {
      onAmountChange(0); // Invalid amount
    }
  }, [calculatedFractions, minFractionSize, onAmountChange]);

  return (
    <Card className="p-4 bg-secondary/20">
      <div className="space-y-2">
        <Label htmlFor="dollar-input" className="text-sm font-medium">
          Calculate fractions by $ amount
        </Label>
        <Input
          id="dollar-input"
          type="number"
          placeholder="$1,000"
          value={dollarAmount}
          onChange={(e) => setDollarAmount(e.target.value)}
          className="w-full"
          min="0"
          step="0.01"
        />
        {calculatedFractions > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              ≈ {calculatedFractions.toLocaleString()} fraction
              {calculatedFractions !== 1 ? 's' : ''}
            </p>
            {showWarning && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertCircle className="w-3 h-3" />
                <span>
                  Minimum purchase: {minFractionSize} fraction
                  {minFractionSize !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
