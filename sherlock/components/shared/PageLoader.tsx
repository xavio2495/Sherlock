import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

/**
 * Full-page loading spinner with Sherlock branding
 * Used for initial page loads and critical data fetching
 */
export function PageLoader({ message = 'LOADING...' }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-8">
        {/* Sherlock Logo */}
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Sherlock" width={150} height={50} priority />
        </div>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center gap-4">
          <div className="border-brutalist p-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-2xl font-heading tracking-wider">{message}</p>
        </div>

        {/* Loading Indicator Bars */}
        <div className="flex justify-center gap-2">
          <div className="w-12 h-1 bg-primary animate-pulse [animation-delay:-0.3s]" />
          <div className="w-12 h-1 bg-primary animate-pulse [animation-delay:-0.15s]" />
          <div className="w-12 h-1 bg-primary animate-pulse" />
        </div>
      </div>
    </div>
  );
}
