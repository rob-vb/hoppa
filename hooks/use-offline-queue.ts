import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
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

  // Subscribe to sync engine state changes
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
      setPendingCount(state.pendingOperations);
    });
    return unsubscribe;
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    let mounted = true;

    const checkNetworkState = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) {
          const online = state.isConnected ?? false;
          setIsOnline(online);

          // If we were offline and now online, trigger sync
          if (wasOfflineRef.current && online) {
            console.log('[OfflineQueue] Back online, triggering sync...');
            triggerSyncInternal();
          }
          wasOfflineRef.current = !online;
        }
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
  }, []);

  // Internal sync function with debouncing
  const triggerSyncInternal = useCallback(async () => {
    if (!isAuthenticated || !user || !client) {
      return;
    }

    if (isSyncing) {
      return;
    }

    // Debounce sync calls
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true);
      setError(null);

      try {
        const result = await syncEngine.sync();
        setLastSyncResult(result);

        if (!result.success && result.errors.length > 0) {
          setError(result.errors.join('; '));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        setError(message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [isAuthenticated, user, client, isSyncing]);

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
