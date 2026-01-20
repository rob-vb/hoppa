import { useState, useCallback, useRef, useEffect } from 'react';
import { useConvexClient } from '@/contexts/convex-provider';
import { useAuth } from '@/contexts/auth-context';
import { syncEngine, SyncResult, SyncState } from '@/utils/sync-engine';

export interface InitialSyncState {
  /** Whether the initial sync has been completed for this session */
  hasCompletedInitialSync: boolean;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** The result of the last sync attempt */
  lastSyncResult: SyncResult | null;
  /** Any error that occurred during sync */
  error: string | null;
  /** Sync engine state */
  syncState: SyncState;
}

export interface UseInitialSyncReturn extends InitialSyncState {
  /** Trigger the initial sync manually */
  triggerInitialSync: () => Promise<SyncResult>;
  /** Trigger an incremental sync (for subsequent syncs) */
  triggerSync: () => Promise<SyncResult>;
  /** Reset the sync state (e.g., on logout) */
  resetSyncState: () => Promise<void>;
}

/**
 * Hook for managing initial sync of local SQLite data to Convex.
 *
 * This hook:
 * - Initializes the sync engine when user is authenticated
 * - Provides methods to trigger initial and incremental syncs
 * - Tracks sync state and results
 * - Automatically resets on logout
 */
export function useInitialSync(): UseInitialSyncReturn {
  const client = useConvexClient();
  const { user, isAuthenticated } = useAuth();

  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  // Track if we've initialized the sync engine for this session
  const isInitializedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  // Subscribe to sync engine state changes
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  // Initialize sync engine when user becomes authenticated
  useEffect(() => {
    const initializeSyncEngine = async () => {
      // Reset if user changed or logged out
      if (previousUserIdRef.current !== user?._id) {
        if (isInitializedRef.current) {
          await syncEngine.reset();
          isInitializedRef.current = false;
          setHasCompletedInitialSync(false);
          setLastSyncResult(null);
          setError(null);
        }
        previousUserIdRef.current = user?._id ?? null;
      }

      // Initialize if authenticated and not yet initialized
      if (isAuthenticated && user && client && !isInitializedRef.current) {
        try {
          await syncEngine.initialize(client, user._id);
          isInitializedRef.current = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to initialize sync';
          setError(message);
          console.error('Sync engine initialization failed:', err);
        }
      }
    };

    initializeSyncEngine();
  }, [isAuthenticated, user, client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't reset on unmount - let the sync engine persist across screens
    };
  }, []);

  /**
   * Trigger the initial full sync.
   * This uploads all local data that doesn't have mappings and pulls remote data.
   */
  const triggerInitialSync = useCallback(async (): Promise<SyncResult> => {
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

    if (!isInitializedRef.current) {
      try {
        await syncEngine.initialize(client, user._id);
        isInitializedRef.current = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize sync';
        const result: SyncResult = {
          success: false,
          pushed: 0,
          pulled: 0,
          errors: [message],
        };
        setError(message);
        setLastSyncResult(result);
        return result;
      }
    }

    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncEngine.fullSync();
      setLastSyncResult(result);

      if (result.success) {
        setHasCompletedInitialSync(true);
      } else {
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
  }, [isAuthenticated, user, client]);

  /**
   * Trigger an incremental sync.
   * This processes the sync queue and pulls any changes from remote.
   */
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

    if (!isInitializedRef.current) {
      // For incremental sync, if not initialized, do initial sync instead
      return triggerInitialSync();
    }

    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncEngine.sync();
      setLastSyncResult(result);

      if (!result.success) {
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
  }, [isAuthenticated, user, client, triggerInitialSync]);

  /**
   * Reset sync state (e.g., on logout).
   */
  const resetSyncState = useCallback(async (): Promise<void> => {
    await syncEngine.reset();
    isInitializedRef.current = false;
    previousUserIdRef.current = null;
    setHasCompletedInitialSync(false);
    setLastSyncResult(null);
    setError(null);
  }, []);

  return {
    hasCompletedInitialSync,
    isSyncing,
    lastSyncResult,
    error,
    syncState,
    triggerInitialSync,
    triggerSync,
    resetSyncState,
  };
}
