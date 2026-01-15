import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

/**
 * Full-page loading spinner with Sherlock branding
 * Used for initial page loads and critical data fetching
 */
export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* Sherlock Logo Placeholder */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mantle-primary to-mantle-secondary/20 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">S</span>
            </div>
            <div className="absolute -inset-2 bg-gradient-to-br from-mantle-secondary/20 to-transparent rounded-full animate-pulse" />
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-mantle-primary" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{message}</p>
        </div>

        {/* Loading Indicator Dots */}
        <div className="flex justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-mantle-secondary animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-mantle-secondary animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-mantle-secondary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
