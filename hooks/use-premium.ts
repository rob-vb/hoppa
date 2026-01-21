import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/subscription-context';

/**
 * Simple hook to check if the user has premium access.
 * Use this in components that need to gate features behind premium.
 *
 * @example
 * ```tsx
 * function PremiumFeature() {
 *   const { isPremium, showPaywall } = usePremium();
 *
 *   if (!isPremium) {
 *     return <Button onPress={showPaywall}>Upgrade to Premium</Button>;
 *   }
 *
 *   return <PremiumContent />;
 * }
 * ```
 */
export function usePremium() {
  const router = useRouter();
  const { isPremium, currentPlan, isLoading, offerings } = useSubscription();

  const showPaywall = useCallback(() => {
    router.push('/paywall');
  }, [router]);

  return {
    isPremium,
    currentPlan,
    isLoading,
    hasOfferings: offerings !== null,
    showPaywall,
  };
}
