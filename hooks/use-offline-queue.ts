import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { syncEngine, SyncState, SyncResult } from '@/utils/sync-engine';
import { useAuth } from '@/contexts/auth-context';
import { useConvexClient } from '@/contexts/convex-provider';

export interface OfflineQueueState {
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Number of pending operations in the queue */
  pendingCount: number;
  /** The result of the last sync attempt */
  lastSyncResult: SyncResult | null;
  /** Any error that occurred */
  error: string | null;
  /** Sync engine state */
  syncState: SyncState;
}

export interface UseOfflineQueueReturn extends OfflineQueueState {
  /** Manually trigger a sync */
  triggerSync: () => Promise<SyncResult>;
  /** Check if there are pending changes */
  hasPendingChanges: boolean;
}

/**
 * Hook for managing offline queue and automatic synchronization.
 *
 * This hook:
 * - Monitors network connectivity status
 * - Automatically syncs pending changes when coming back online
 * - Syncs when app returns from background (if there are pending changes)
 * - Provides methods to manually trigger sync
 * - Tracks pending operation count
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const { user, isAuthenticated } = useAuth();
  const client = useConvexClient();

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  const wasOfflineRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  // Keep isSyncingRef in sync with state
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Subscribe to sync engine state changes
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
      setPendingCount(state.pendingOperations);
    });
    return unsubscribe;
  }, []);

  // Internal sync function with debouncing - uses refs to avoid stale closures
  const performSync = useCallback(async () => {
    if (!isAuthenticated || !user || !client) {
      console.log('[OfflineQueue] Cannot sync: not authenticated');
      return;
    }

    if (isSyncingRef.current) {
      console.log('[OfflineQueue] Sync already in progress, skipping');
      return;
    }

    // Clear any pending debounced sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Debounce: wait 500ms before actually syncing
    syncTimeoutRef.current = setTimeout(async () => {
      if (isSyncingRef.current) {
        return;
      }

      setIsSyncing(true);
      setError(null);
      console.log('[OfflineQueue] Starting sync...');

      try {
        const result = await syncEngine.sync();
        setLastSyncResult(result);

        if (result.success) {
          console.log(
            `[OfflineQueue] Sync completed: pushed ${result.pushed}, pulled ${result.pulled}`
          );
        } else {
          console.log('[OfflineQueue] Sync completed with errors:', result.errors);
          setError(result.errors.join('; '));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        console.error('[OfflineQueue] Sync failed:', message);
        setError(message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [isAuthenticated, user, client]);

  // Monitor network connectivity
  useEffect(() => {
    let mounted = true;

    const checkNetworkState = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!mounted) return;

        const online = state.isConnected ?? false;
        setIsOnline(online);

        // If we were offline and now online, trigger sync
        if (wasOfflineRef.current && online) {
          console.log('[OfflineQueue] Network restored, triggering sync...');
          performSync();
        }
        wasOfflineRef.current = !online;
      } catch (err) {
        console.warn('[OfflineQueue] Failed to get network state:', err);
        // Assume online if we can't determine
        if (mounted) {
          setIsOnline(true);
        }
      }
    };

    // Check initial state
    checkNetworkState();

    // Set up polling for network state (expo-network doesn't have event listeners on all platforms)
    const interval = setInterval(checkNetworkState, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [performSync]);

  // Monitor app state changes - sync when returning from background
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - check if we're online and have pending changes
        try {
          const state = await Network.getNetworkStateAsync();
          const online = state.isConnected ?? false;
          setIsOnline(online);

          if (online && syncEngine.hasPendingChanges()) {
            console.log('[OfflineQueue] App foregrounded with pending changes, triggering sync...');
            performSync();
          }
        } catch (err) {
          console.warn('[OfflineQueue] Failed to check network on foreground:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [performSync]);

  // Public sync trigger
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (!isAuthenticated || !user || !client) {
      const result: SyncResult = {
        success: false,
        pushed: 0,
        pulled: 0,
        errors: ['Not authenticated'],
      };
      setLastSyncResult(result);
      return result;
    }

    if (!isOnline) {
      const result: SyncResult = {
        success: false,
        pushed: 0,
        pulled: 0,
        errors: ['Device is offline'],
      };
      setLastSyncResult(result);
      return result;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncEngine.sync();
      setLastSyncResult(result);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors.join('; '));
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      const result: SyncResult = {
        success: false,
        pushed: 0,
        pulled: 0,
        errors: [message],
      };
      setLastSyncResult(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, client, isOnline]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    error,
    syncState,
    triggerSync,
    hasPendingChanges: pendingCount > 0,
  };
}
