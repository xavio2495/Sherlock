'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionStatusProps {
  txHash: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export function TransactionStatus({ txHash, status, message }: TransactionStatusProps) {
  const explorerUrl = `https://explorer.testnet.mantle.xyz/tx/${txHash}`;

  const handleCopyTxHash = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      toast.success('Transaction hash copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transaction hash');
    }
  };

  // Status configuration
  const statusConfig = {
    pending: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: 'Transaction pending...',
      variant: 'default' as const,
      className: 'border-blue-200 bg-blue-50',
      textColor: 'text-blue-700',
    },
    success: {
      icon: <CheckCircle className="h-4 w-4" />,
      text: 'Transaction successful!',
      variant: 'default' as const,
      className: 'border-green-200 bg-green-50',
      textColor: 'text-green-700',
    },
    error: {
      icon: <XCircle className="h-4 w-4" />,
      text: 'Transaction failed',
      variant: 'destructive' as const,
      className: 'border-red-200 bg-red-50',
      textColor: 'text-red-700',
    },
  };

  const config = statusConfig[status];

  return (
    <Alert variant={config.variant} className={config.className}>
      <div className="flex items-start gap-3">
        <div className={config.textColor}>{config.icon}</div>

        <div className="flex-1 space-y-2">
          <AlertDescription className={`${config.textColor} font-medium`}>
            {config.text}
          </AlertDescription>

          {/* Error message */}
          {status === 'error' && message && (
            <AlertDescription className="text-sm text-red-600">{message}</AlertDescription>
          )}

          {/* Transaction hash and actions */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <code className="text-xs bg-white/50 px-2 py-1 rounded border">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </code>

            <Button variant="outline" size="sm" onClick={handleCopyTxHash} className="h-7 text-xs">
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>

            <Button variant="outline" size="sm" asChild className="h-7 text-xs">
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                View on Explorer
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
