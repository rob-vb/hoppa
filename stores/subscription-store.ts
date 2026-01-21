import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual';

interface SubscriptionState {
  isInitialized: boolean;
  isPremium: boolean;
  currentPlan: SubscriptionPlan;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  isLoading: boolean;
  error: string | null;
}

interface SubscriptionActions {
  initialize: (userId: string) => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type SubscriptionStore = SubscriptionState & SubscriptionActions;

const ENTITLEMENT_ID = 'premium';

const initialState: SubscriptionState = {
  isInitialized: false,
  isPremium: false,
  currentPlan: 'free',
  customerInfo: null,
  offerings: null,
  isLoading: false,
  error: null,
};

function determinePlan(customerInfo: CustomerInfo): SubscriptionPlan {
  const activeSubscriptions = customerInfo.activeSubscriptions;

  if (activeSubscriptions.length === 0) {
    return 'free';
  }

  // Check for annual subscription first
  const hasAnnual = activeSubscriptions.some(
    (sub) => sub.includes('annual') || sub.includes('yearly')
  );
  if (hasAnnual) {
    return 'annual';
  }

  // Check for monthly subscription
  const hasMonthly = activeSubscriptions.some(
    (sub) => sub.includes('monthly') || sub.includes('month')
  );
  if (hasMonthly) {
    return 'monthly';
  }

  // Default to monthly if premium but can't determine type
  return 'monthly';
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...initialState,

  initialize: async (userId: string) => {
    const { isInitialized } = get();
    if (isInitialized) return;

    try {
      set({ isLoading: true, error: null });

      const apiKey = Platform.select({
        ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
        android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
        default: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      });

      if (!apiKey) {
        throw new Error('RevenueCat API key not configured');
      }

      await Purchases.configure({
        apiKey,
        appUserID: userId,
      });

      set({ isInitialized: true });

      // Fetch initial subscription status and offerings
      await get().checkSubscriptionStatus();
      await get().fetchOfferings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initialize RevenueCat';
      set({ error: message, isLoading: false });
    }
  },

  checkSubscriptionStatus: async () => {
    try {
      set({ isLoading: true, error: null });

      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      const currentPlan = determinePlan(customerInfo);

      set({
        customerInfo,
        isPremium,
        currentPlan,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to check subscription status';
      set({ error: message, isLoading: false });
    }
  },

  fetchOfferings: async () => {
    try {
      set({ isLoading: true, error: null });

      const offerings = await Purchases.getOfferings();
      set({
        offerings: offerings.current,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch offerings';
      set({ error: message, isLoading: false });
    }
  },

  purchasePackage: async (pkg: PurchasesPackage) => {
    try {
      set({ isLoading: true, error: null });

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      const currentPlan = determinePlan(customerInfo);

      set({
        customerInfo,
        isPremium,
        currentPlan,
        isLoading: false,
      });

      return isPremium;
    } catch (error) {
      // User cancelled is not an error
      if (
        error instanceof Error &&
        error.message.includes('userCancelled')
      ) {
        set({ isLoading: false });
        return false;
      }

      const message =
        error instanceof Error ? error.message : 'Failed to complete purchase';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  restorePurchases: async () => {
    try {
      set({ isLoading: true, error: null });

      const customerInfo = await Purchases.restorePurchases();
      const isPremium =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      const currentPlan = determinePlan(customerInfo);

      set({
        customerInfo,
        isPremium,
        currentPlan,
        isLoading: false,
      });

      return isPremium;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore purchases';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
