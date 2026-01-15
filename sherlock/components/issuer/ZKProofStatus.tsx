'use client';

import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ZKProofStatusProps {
  status: 'idle' | 'generating' | 'ready' | 'error';
  message?: string;
}

export function ZKProofStatus({ status, message }: ZKProofStatusProps) {
  // Don't render anything in idle state
  if (status === 'idle') {
    return null;
  }

  // Generating state with progress bar
  if (status === 'generating') {
    return (
      <Alert className="border-purple-200 bg-purple-50">
        <div className="flex items-start gap-3">
          <Loader2 className="h-4 w-4 text-purple-600 animate-spin shrink-0 mt-0.5" />

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <AlertDescription className="text-purple-700 font-medium">
                ⏳ Generating ZK proof
                <span className="animate-pulse">...</span>
              </AlertDescription>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-purple-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Zero-Knowledge proofs allow you to prove eligibility or ownership without
                      revealing your private information. This cryptographic computation may take
                      10-20 seconds.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Progress value={undefined} className="h-2 bg-purple-100" />

            <p className="text-xs text-purple-600">⏱️ This may take 10-20 seconds</p>
          </div>
        </div>
      </Alert>
    );
  }

  // Ready/Success state
  if (status === 'ready') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <AlertDescription className="text-green-700 font-medium">
            ✓ ZK proof generated successfully
          </AlertDescription>
          <Badge variant="outline" className="ml-auto bg-green-100 text-green-700 border-green-300">
            Ready
          </Badge>
        </div>
      </Alert>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <Alert variant="destructive" className="border-red-200 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <AlertDescription className="text-red-700 font-medium">
              ❌ Failed to generate proof
            </AlertDescription>
            {message && (
              <AlertDescription className="text-sm text-red-600 mt-1">{message}</AlertDescription>
            )}
          </div>
        </div>
      </Alert>
    );
  }

  return null;
}
