'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Error boundary UI for handling runtime errors
 * Automatically displayed by Next.js when an error occurs
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('[Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-warning shadow-brutalist">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-destructive border-brutalist">
              <AlertCircle className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-heading">ERROR!</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            An unexpected error occurred while loading this page. Please try again or return to the
            homepage.
          </p>

          {/* Error Details (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium hover:opacity-70">
                ERROR DETAILS (DEVELOPMENT)
              </summary>
              <div className="mt-2 p-3 bg-muted border-brutalist">
                <p className="text-xs font-mono text-destructive break-all">{error.message}</p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground mt-2">Digest: {error.digest}</p>
                )}
              </div>
            </details>
          )}

          {/* Common Issues */}
          <div className="mt-6 p-4 bg-secondary border-warning border-brutalist">
            <h4 className="text-sm font-heading mb-2">COMMON ISSUES:</h4>
            <ul className="text-sm space-y-1">
              <li>■ Backend server not running</li>
              <li>■ Wallet not connected or wrong network</li>
              <li>■ Contract addresses not configured</li>
              <li>■ Browser extension conflicts</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button onClick={reset} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            TRY AGAIN
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              GO HOME
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
