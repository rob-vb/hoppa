import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useConvexClient } from '@/contexts/convex-provider';
import { useAuth } from '@/contexts/auth-context';
import { syncEngine, SyncResult, SyncState } from '@/utils/sync-engine';
import { api } from '@/convex/_generated/api';
import * as db from '@/db/database';
import type { Id } from '@/convex/_generated/dataModel';

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
  /** Whether real-time subscriptions are active */
  isSubscribed: boolean;
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
 * - Enables real-time subscriptions after initial sync completes
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
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Track if we've initialized the sync engine for this session
  const isInitializedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);
  const previousSchemasRef = useRef<string | null>(null);

  // Subscribe to sync engine state changes
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  // ============================================
  // Real-time Convex Subscriptions
  // ============================================

  // Subscribe to schemas list - only after initial sync is done
  const schemas = useQuery(
    api.schemas.list,
    isAuthenticated && user && hasCompletedInitialSync
      ? { userId: user._id as Id<'users'> }
      : 'skip'
  );

  // Process schema changes from subscription
  useEffect(() => {
    if (!schemas || !hasCompletedInitialSync || !user) return;

    // Mark as subscribed
    if (!isSubscribed) {
      setIsSubscribed(true);
    }

    // Create fingerprint for change detection
    const currentFingerprint = JSON.stringify(
      schemas.map((s: { _id: string; updatedAt: number; name: string }) => ({ id: s._id, updatedAt: s.updatedAt, name: s.name }))
    );

    // Skip if nothing changed
    if (currentFingerprint === previousSchemasRef.current) return;
    previousSchemasRef.current = currentFingerprint;

    // Process real-time changes
    processSchemaSubscriptionChanges(schemas);
  }, [schemas, hasCompletedInitialSync, user, isSubscribed]);

  // Helper to process schema subscription changes
  const processSchemaSubscriptionChanges = async (
    remoteSchemas: NonNullable<typeof schemas>
  ) => {
    try {
      // Handle new and updated schemas
      for (const remote of remoteSchemas) {
        const localId = syncEngine.getLocalIdFromConvex(remote._id);

        if (!localId) {
          // New schema from remote - create locally
          const newLocal = await db.createSchema(
            remote.name,
            remote.progressiveLoadingEnabled
          );
          await syncEngine.setIdMapping(newLocal.id, remote._id, 'schema');
          console.log('[Subscription] Created local schema from remote:', remote.name);
        } else {
          // Existing schema - update if remote is newer
          const localSchema = await db.getSchemaById(localId);
          if (localSchema && remote.updatedAt > localSchema.updatedAt) {
            await db.updateSchema(localId, {
              name: remote.name,
              progressiveLoadingEnabled: remote.progressiveLoadingEnabled,
            });
            console.log('[Subscription] Updated local schema from remote:', remote.name);
          }
        }
      }

      // Handle deleted schemas
      const localSchemas = await db.getSchemas();
      for (const local of localSchemas) {
        const convexId = syncEngine.getIdMapping(local.id);
        if (convexId) {
          const stillExists = remoteSchemas.some((s: { _id: string }) => s._id === convexId);
          if (!stillExists) {
            await db.deleteSchema(local.id);
            await syncEngine.removeIdMapping(local.id);
            console.log('[Subscription] Deleted local schema (removed from remote):', local.name);
          }
        }
      }
    } catch (err) {
      console.error('[Subscription] Failed to process schema changes:', err);
    }
  };

  // Initialize sync engine when user becomes authenticated
  useEffect(() => {
    const initializeSyncEngine = async () => {
      // Reset if user changed or logged out
      if (previousUserIdRef.current !== user?._id) {
        if (isInitializedRef.current) {
          await syncEngine.reset();
          isInitializedRef.current = false;
          previousSchemasRef.current = null;
          setHasCompletedInitialSync(false);
          setLastSyncResult(null);
          setError(null);
          setIsSubscribed(false);
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
    previousSchemasRef.current = null;
    setHasCompletedInitialSync(false);
    setLastSyncResult(null);
    setError(null);
    setIsSubscribed(false);
  }, []);

  return {
    hasCompletedInitialSync,
    isSyncing,
    lastSyncResult,
    error,
    syncState,
    isSubscribed,
    triggerInitialSync,
    triggerSync,
    resetSyncState,
  };
}
