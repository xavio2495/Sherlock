import { PageLoader } from '@/components/shared/PageLoader';

/**
 * Loading UI shown during page transitions
 * Automatically displayed by Next.js when navigating between pages
 */
export default function Loading() {
  return <PageLoader message="Loading page..." />;
}
