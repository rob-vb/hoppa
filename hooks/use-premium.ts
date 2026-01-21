import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/subscription-context';
import { useSchemaStore } from '@/stores/schema-store';

// Free tier limits
export const FREE_TIER_SCHEMA_LIMIT = 3;

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
  const { schemas } = useSchemaStore();

  const showPaywall = useCallback(() => {
    router.push('/paywall');
  }, [router]);

  // Calculate schema limit info
  const schemaCount = schemas.length;
  const canCreateSchema = useMemo(() => {
    if (isPremium) return true;
    return schemaCount < FREE_TIER_SCHEMA_LIMIT;
  }, [isPremium, schemaCount]);

  const schemasRemaining = useMemo(() => {
    if (isPremium) return Infinity;
    return Math.max(0, FREE_TIER_SCHEMA_LIMIT - schemaCount);
  }, [isPremium, schemaCount]);

  return {
    isPremium,
    currentPlan,
    isLoading,
    hasOfferings: offerings !== null,
    showPaywall,
    // Schema limits
    canCreateSchema,
    schemaCount,
    schemaLimit: isPremium ? Infinity : FREE_TIER_SCHEMA_LIMIT,
    schemasRemaining,
  };
}
