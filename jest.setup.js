// Jest setup file
// Add any global test setup here

// Mock expo modules that may cause issues in tests
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
  NetworkStateType: {
    NONE: 'none',
    WIFI: 'wifi',
    CELLULAR: 'cellular',
    UNKNOWN: 'unknown',
  },
}));

// Mock convex modules that may not be generated during tests
jest.mock('convex/react', () => ({
  ConvexReactClient: jest.fn(),
}));

jest.mock('convex/server', () => ({
  FunctionReference: jest.fn(),
  FunctionReturnType: jest.fn(),
}));

// Mock sync engine to avoid convex dependencies in tests
jest.mock('@/utils/sync-engine', () => ({
  syncEngine: {
    queueCreate: jest.fn().mockResolvedValue(undefined),
    queueUpdate: jest.fn().mockResolvedValue(undefined),
    queueDelete: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue({
      status: 'idle',
      lastSyncAt: null,
      pendingOperations: 0,
      error: null,
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0, errors: [] }),
    fullSync: jest.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0, errors: [] }),
  },
  useSyncEngine: jest.fn().mockReturnValue({
    status: 'idle',
    lastSyncAt: null,
    pendingOperations: 0,
    error: null,
    sync: jest.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0, errors: [] }),
    fullSync: jest.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0, errors: [] }),
    hasPendingChanges: false,
  }),
}));
