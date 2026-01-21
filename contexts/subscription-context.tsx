import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  useSubscriptionStore,
  type SubscriptionPlan,
} from '@/stores/subscription-store';
import { useAIImportStore } from '@/stores/ai-import-store';
import { useAuth } from '@/contexts/auth-context';
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';

interface SubscriptionContextValue {
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  isLoading: boolean;
  error: string | null;
  offerings: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  clearError: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user, isAuthenticated } = useAuth();

  const {
    isPremium,
    currentPlan,
    isLoading,
    error,
    offerings,
    isInitialized,
    initialize,
    checkSubscriptionStatus,
    purchasePackage: storePurchasePackage,
    restorePurchases: storeRestorePurchases,
    clearError,
    reset,
    setupCustomerInfoListener,
  } = useSubscriptionStore();

  // Convex subscription status (server-side truth)
  const serverSubscription = useQuery(
    api.subscriptions.getSubscriptionStatus,
    isAuthenticated ? undefined : 'skip'
  );

  const updateSubscriptionMutation = useMutation(api.subscriptions.updateSubscription);
  const clearSubscriptionMutation = useMutation(api.subscriptions.clearSubscription);

  // Initialize RevenueCat when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?._id && !isInitialized) {
      initialize(user._id);
    }
  }, [isAuthenticated, user?._id, isInitialized, initialize]);

  // Setup customer info listener for subscription changes (renewals, expirations)
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      const cleanup = setupCustomerInfoListener();
      return cleanup;
    }
  }, [isInitialized, isAuthenticated, setupCustomerInfoListener]);

  // Reset subscription state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      reset();
    }
  }, [isAuthenticated, reset]);

  // Sync server subscription status with local state
  useEffect(() => {
    if (serverSubscription && serverSubscription.isPremium !== isPremium) {
      checkSubscriptionStatus();
    }
  }, [serverSubscription, isPremium, checkSubscriptionStatus]);

  // Sync local subscription changes to Convex backend (handles renewals/expirations)
  useEffect(() => {
    if (!isAuthenticated || !isInitialized) return;

    const { customerInfo } = useSubscriptionStore.getState();
    if (!customerInfo) return;

    const expirationDate =
      customerInfo.entitlements.active['premium']?.expirationDate;

    // Sync to Convex backend
    if (isPremium) {
      updateSubscriptionMutation({
        isPremium: true,
        subscriptionPlan: currentPlan,
        subscriptionExpiresAt: expirationDate
          ? new Date(expirationDate).getTime()
          : undefined,
      }).catch(console.error);
    } else if (serverSubscription?.isPremium) {
      // User was premium but subscription expired
      clearSubscriptionMutation().catch(console.error);
    }
  }, [isPremium, currentPlan, isAuthenticated, isInitialized, serverSubscription?.isPremium, updateSubscriptionMutation, clearSubscriptionMutation]);

  // Sync premium status with AI import store for rate limiting
  useEffect(() => {
    useAIImportStore.getState().setPremiumStatus(isPremium);
  }, [isPremium]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      const success = await storePurchasePackage(pkg);

      if (success) {
        // Sync with Convex backend
        const { currentPlan: newPlan, customerInfo } = useSubscriptionStore.getState();
        const expirationDate =
          customerInfo?.entitlements.active['premium']?.expirationDate;

        await updateSubscriptionMutation({
          isPremium: true,
          subscriptionPlan: newPlan,
          subscriptionExpiresAt: expirationDate
            ? new Date(expirationDate).getTime()
            : undefined,
        });
      }

      return success;
    },
    [storePurchasePackage, updateSubscriptionMutation]
  );

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    const success = await storeRestorePurchases();

    if (success) {
      // Sync with Convex backend
      const { currentPlan: newPlan, customerInfo } = useSubscriptionStore.getState();
      const expirationDate =
        customerInfo?.entitlements.active['premium']?.expirationDate;

      await updateSubscriptionMutation({
        isPremium: true,
        subscriptionPlan: newPlan,
        subscriptionExpiresAt: expirationDate
          ? new Date(expirationDate).getTime()
          : undefined,
      });
    }

    return success;
  }, [storeRestorePurchases, updateSubscriptionMutation]);

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        currentPlan,
        isLoading,
        error,
        offerings,
        purchasePackage,
        restorePurchases,
        clearError,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
