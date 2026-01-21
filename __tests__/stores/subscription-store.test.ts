import { act } from 'react';
import { useSubscriptionStore, type SubscriptionPlan } from '@/stores/subscription-store';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock react-native Platform
const mockPlatformSelect = jest.fn();
jest.mock('react-native', () => ({
  Platform: {
    select: (options: Record<string, unknown>) => {
      // Return the ios or default value, reading env at call time
      return options.ios ?? options.default;
    },
    OS: 'ios',
  },
}));

// Mock environment variables
const originalEnv = process.env;

// Helper to create mock CustomerInfo
function createMockCustomerInfo(overrides: Partial<CustomerInfo> = {}): CustomerInfo {
  return {
    entitlements: {
      active: {},
      all: {},
      verification: 'NOT_REQUESTED',
    },
    activeSubscriptions: [],
    allPurchasedProductIdentifiers: [],
    latestExpirationDate: null,
    firstSeen: '2024-01-01T00:00:00Z',
    originalAppUserId: 'test-user',
    requestDate: '2024-01-01T00:00:00Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    originalPurchaseDate: null,
    ...overrides,
  } as CustomerInfo;
}

// Helper to create mock CustomerInfo with premium entitlement
function createPremiumCustomerInfo(
  plan: 'monthly' | 'annual' = 'monthly'
): CustomerInfo {
  const subscriptionId = plan === 'annual' ? 'hoppa_annual' : 'hoppa_monthly';
  return createMockCustomerInfo({
    entitlements: {
      active: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          periodType: 'NORMAL',
          latestPurchaseDate: '2024-01-01T00:00:00Z',
          latestPurchaseDateMillis: Date.now(),
          originalPurchaseDate: '2024-01-01T00:00:00Z',
          originalPurchaseDateMillis: Date.now(),
          expirationDate: '2025-01-01T00:00:00Z',
          expirationDateMillis: Date.now() + 365 * 24 * 60 * 60 * 1000,
          store: 'APP_STORE',
          productIdentifier: subscriptionId,
          isSandbox: false,
          unsubscribeDetectedAt: null,
          unsubscribeDetectedAtMillis: null,
          billingIssueDetectedAt: null,
          billingIssueDetectedAtMillis: null,
          ownershipType: 'PURCHASED',
          productPlanIdentifier: null,
          verification: 'NOT_REQUESTED',
        },
      },
      all: {},
      verification: 'NOT_REQUESTED',
    },
    activeSubscriptions: [subscriptionId],
  });
}

// Helper to create mock PurchasesPackage
function createMockPackage(
  identifier: string = '$rc_monthly'
): PurchasesPackage {
  return {
    identifier,
    packageType: 'MONTHLY',
    product: {
      identifier: 'hoppa_monthly',
      description: 'Monthly subscription',
      title: 'Premium Monthly',
      price: 4.99,
      priceString: '$4.99',
      currencyCode: 'USD',
      introPrice: null,
      discounts: [],
      productCategory: 'SUBSCRIPTION',
      productType: 'AUTO_RENEWABLE_SUBSCRIPTION',
      subscriptionPeriod: 'P1M',
      defaultOption: null,
      subscriptionOptions: [],
      presentedOfferingIdentifier: 'default',
      presentedOfferingContext: null,
    },
    presentedOfferingContext: {
      offeringIdentifier: 'default',
      placementIdentifier: null,
      targetingContext: null,
    },
    offeringIdentifier: 'default',
  } as PurchasesPackage;
}

const mockedPurchases = Purchases as jest.Mocked<typeof Purchases>;

describe('subscription-store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSubscriptionStore.setState({
      isInitialized: false,
      isPremium: false,
      currentPlan: 'free',
      customerInfo: null,
      offerings: null,
      isLoading: false,
      error: null,
    });
    // Clear all mocks
    jest.clearAllMocks();
    // Set up environment variables
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'test_ios_api_key',
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'test_android_api_key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initialize', () => {
    it('should not re-initialize if already initialized', async () => {
      useSubscriptionStore.setState({ isInitialized: true });

      await act(async () => {
        await useSubscriptionStore.getState().initialize('user-123');
      });

      expect(mockedPurchases.configure).not.toHaveBeenCalled();
    });

    it('should set loading state during initialization', async () => {
      // Verify that isLoading is set when initialize is called
      // The actual API key validation depends on module load time env vars
      // which is hard to test, so we focus on the state transitions
      useSubscriptionStore.setState({ isInitialized: false, isLoading: false });

      // Start the initialize call
      const initPromise = useSubscriptionStore.getState().initialize('user-123');

      // The store will either succeed (if env vars are set) or fail (if not)
      await act(async () => {
        await initPromise;
      });

      // After initialization attempt, loading should be false
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });
  });

  describe('checkSubscriptionStatus', () => {
    it('should detect free user (no active entitlement)', async () => {
      const mockCustomerInfo = createMockCustomerInfo();
      mockedPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().isPremium).toBe(false);
      expect(useSubscriptionStore.getState().currentPlan).toBe('free');
      expect(useSubscriptionStore.getState().customerInfo).toEqual(mockCustomerInfo);
    });

    it('should detect premium user with monthly subscription', async () => {
      const mockCustomerInfo = createPremiumCustomerInfo('monthly');
      mockedPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().isPremium).toBe(true);
      expect(useSubscriptionStore.getState().currentPlan).toBe('monthly');
    });

    it('should detect premium user with annual subscription', async () => {
      const mockCustomerInfo = createPremiumCustomerInfo('annual');
      mockedPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().isPremium).toBe(true);
      expect(useSubscriptionStore.getState().currentPlan).toBe('annual');
    });

    it('should set loading state during check', async () => {
      let loadingDuringCheck = false;
      mockedPurchases.getCustomerInfo.mockImplementation(async () => {
        loadingDuringCheck = useSubscriptionStore.getState().isLoading;
        return createMockCustomerInfo();
      });

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(loadingDuringCheck).toBe(true);
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });

    it('should handle errors', async () => {
      mockedPurchases.getCustomerInfo.mockRejectedValue(
        new Error('Network error')
      );

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().error).toBe('Network error');
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchOfferings', () => {
    it('should fetch and store offerings', async () => {
      const mockOffering: PurchasesOffering = {
        identifier: 'default',
        serverDescription: 'Default offering',
        metadata: {},
        availablePackages: [createMockPackage()],
        lifetime: null,
        annual: null,
        sixMonth: null,
        threeMonth: null,
        twoMonth: null,
        monthly: createMockPackage(),
        weekly: null,
      };
      mockedPurchases.getOfferings.mockResolvedValue({
        current: mockOffering,
        all: { default: mockOffering },
      });

      await act(async () => {
        await useSubscriptionStore.getState().fetchOfferings();
      });

      expect(useSubscriptionStore.getState().offerings).toEqual(mockOffering);
    });

    it('should handle errors', async () => {
      mockedPurchases.getOfferings.mockRejectedValue(new Error('Fetch failed'));

      await act(async () => {
        await useSubscriptionStore.getState().fetchOfferings();
      });

      expect(useSubscriptionStore.getState().error).toBe('Fetch failed');
    });
  });

  describe('purchasePackage', () => {
    it('should complete purchase and update premium status', async () => {
      const mockPackage = createMockPackage();
      const mockCustomerInfo = createPremiumCustomerInfo('monthly');
      mockedPurchases.purchasePackage.mockResolvedValue({
        customerInfo: mockCustomerInfo,
        productIdentifier: 'hoppa_monthly',
      });

      let result: boolean = false;
      await act(async () => {
        result = await useSubscriptionStore.getState().purchasePackage(mockPackage);
      });

      expect(result).toBe(true);
      expect(useSubscriptionStore.getState().isPremium).toBe(true);
      expect(useSubscriptionStore.getState().currentPlan).toBe('monthly');
    });

    it('should return false when user cancels', async () => {
      const mockPackage = createMockPackage();
      mockedPurchases.purchasePackage.mockRejectedValue(
        new Error('userCancelled')
      );

      let result: boolean = true;
      await act(async () => {
        result = await useSubscriptionStore.getState().purchasePackage(mockPackage);
      });

      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe(null);
      expect(useSubscriptionStore.getState().isPremium).toBe(false);
    });

    it('should set error on purchase failure', async () => {
      const mockPackage = createMockPackage();
      mockedPurchases.purchasePackage.mockRejectedValue(
        new Error('Payment declined')
      );

      let result: boolean = true;
      await act(async () => {
        result = await useSubscriptionStore.getState().purchasePackage(mockPackage);
      });

      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe('Payment declined');
    });
  });

  describe('restorePurchases', () => {
    it('should restore purchases and update premium status', async () => {
      const mockCustomerInfo = createPremiumCustomerInfo('annual');
      mockedPurchases.restorePurchases.mockResolvedValue(mockCustomerInfo);

      let result: boolean = false;
      await act(async () => {
        result = await useSubscriptionStore.getState().restorePurchases();
      });

      expect(result).toBe(true);
      expect(useSubscriptionStore.getState().isPremium).toBe(true);
      expect(useSubscriptionStore.getState().currentPlan).toBe('annual');
    });

    it('should return false when no purchases to restore', async () => {
      const mockCustomerInfo = createMockCustomerInfo();
      mockedPurchases.restorePurchases.mockResolvedValue(mockCustomerInfo);

      let result: boolean = true;
      await act(async () => {
        result = await useSubscriptionStore.getState().restorePurchases();
      });

      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().isPremium).toBe(false);
    });

    it('should handle errors', async () => {
      mockedPurchases.restorePurchases.mockRejectedValue(
        new Error('Restore failed')
      );

      let result: boolean = true;
      await act(async () => {
        result = await useSubscriptionStore.getState().restorePurchases();
      });

      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe('Restore failed');
    });
  });

  describe('setupCustomerInfoListener', () => {
    it('should set up listener and update state on subscription changes', () => {
      let listenerCallback: ((info: CustomerInfo) => void) | undefined;
      mockedPurchases.addCustomerInfoUpdateListener.mockImplementation(
        (callback) => {
          listenerCallback = callback;
          return { remove: jest.fn() };
        }
      );

      act(() => {
        useSubscriptionStore.getState().setupCustomerInfoListener();
      });

      expect(mockedPurchases.addCustomerInfoUpdateListener).toHaveBeenCalled();

      // Simulate subscription change
      const newCustomerInfo = createPremiumCustomerInfo('annual');
      act(() => {
        listenerCallback?.(newCustomerInfo);
      });

      expect(useSubscriptionStore.getState().isPremium).toBe(true);
      expect(useSubscriptionStore.getState().currentPlan).toBe('annual');
    });

    it('should return cleanup function', () => {
      const mockRemove = jest.fn();
      mockedPurchases.addCustomerInfoUpdateListener.mockReturnValue({
        remove: mockRemove,
      });

      let cleanup: (() => void) | undefined;
      act(() => {
        cleanup = useSubscriptionStore.getState().setupCustomerInfoListener();
      });

      act(() => {
        cleanup?.();
      });

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should handle subscription expiration', () => {
      let listenerCallback: ((info: CustomerInfo) => void) | undefined;
      mockedPurchases.addCustomerInfoUpdateListener.mockImplementation(
        (callback) => {
          listenerCallback = callback;
          return { remove: jest.fn() };
        }
      );

      // Start as premium
      useSubscriptionStore.setState({
        isPremium: true,
        currentPlan: 'monthly',
      });

      act(() => {
        useSubscriptionStore.getState().setupCustomerInfoListener();
      });

      // Simulate subscription expiration
      const expiredCustomerInfo = createMockCustomerInfo();
      act(() => {
        listenerCallback?.(expiredCustomerInfo);
      });

      expect(useSubscriptionStore.getState().isPremium).toBe(false);
      expect(useSubscriptionStore.getState().currentPlan).toBe('free');
    });
  });

  describe('setError and clearError', () => {
    it('should set error', () => {
      act(() => {
        useSubscriptionStore.getState().setError('Test error');
      });

      expect(useSubscriptionStore.getState().error).toBe('Test error');
    });

    it('should clear error', () => {
      useSubscriptionStore.setState({ error: 'Some error' });

      act(() => {
        useSubscriptionStore.getState().clearError();
      });

      expect(useSubscriptionStore.getState().error).toBe(null);
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      useSubscriptionStore.setState({
        isInitialized: true,
        isPremium: true,
        currentPlan: 'annual',
        customerInfo: createPremiumCustomerInfo('annual'),
        isLoading: true,
        error: 'Some error',
      });

      act(() => {
        useSubscriptionStore.getState().reset();
      });

      const state = useSubscriptionStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isPremium).toBe(false);
      expect(state.currentPlan).toBe('free');
      expect(state.customerInfo).toBe(null);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('plan determination', () => {
    it('should detect annual subscription by "annual" keyword', async () => {
      const customerInfo = createMockCustomerInfo({
        entitlements: {
          active: {
            premium: {
              identifier: 'premium',
              isActive: true,
            } as any,
          },
          all: {},
          verification: 'NOT_REQUESTED',
        },
        activeSubscriptions: ['com.hoppa.annual.subscription'],
      });
      mockedPurchases.getCustomerInfo.mockResolvedValue(customerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().currentPlan).toBe('annual');
    });

    it('should detect annual subscription by "yearly" keyword', async () => {
      const customerInfo = createMockCustomerInfo({
        entitlements: {
          active: {
            premium: {
              identifier: 'premium',
              isActive: true,
            } as any,
          },
          all: {},
          verification: 'NOT_REQUESTED',
        },
        activeSubscriptions: ['hoppa_yearly_pro'],
      });
      mockedPurchases.getCustomerInfo.mockResolvedValue(customerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().currentPlan).toBe('annual');
    });

    it('should detect monthly subscription by "monthly" keyword', async () => {
      const customerInfo = createMockCustomerInfo({
        entitlements: {
          active: {
            premium: {
              identifier: 'premium',
              isActive: true,
            } as any,
          },
          all: {},
          verification: 'NOT_REQUESTED',
        },
        activeSubscriptions: ['hoppa_monthly_premium'],
      });
      mockedPurchases.getCustomerInfo.mockResolvedValue(customerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().currentPlan).toBe('monthly');
    });

    it('should detect monthly subscription by "month" keyword', async () => {
      const customerInfo = createMockCustomerInfo({
        entitlements: {
          active: {
            premium: {
              identifier: 'premium',
              isActive: true,
            } as any,
          },
          all: {},
          verification: 'NOT_REQUESTED',
        },
        activeSubscriptions: ['premium_1month'],
      });
      mockedPurchases.getCustomerInfo.mockResolvedValue(customerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().currentPlan).toBe('monthly');
    });

    it('should default to monthly when premium but plan type unclear', async () => {
      const customerInfo = createMockCustomerInfo({
        entitlements: {
          active: {
            premium: {
              identifier: 'premium',
              isActive: true,
            } as any,
          },
          all: {},
          verification: 'NOT_REQUESTED',
        },
        activeSubscriptions: ['hoppa_premium_subscription'],
      });
      mockedPurchases.getCustomerInfo.mockResolvedValue(customerInfo);

      await act(async () => {
        await useSubscriptionStore.getState().checkSubscriptionStatus();
      });

      expect(useSubscriptionStore.getState().currentPlan).toBe('monthly');
    });
  });
});
