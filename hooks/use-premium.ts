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
  const { isPremium, currentPlan, isLoading, offerings } = useSubscription();

  return {
    isPremium,
    currentPlan,
    isLoading,
    hasOfferings: offerings !== null,
  };
}
