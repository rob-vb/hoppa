import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useInitialSync, type UseInitialSyncReturn } from '@/hooks/use-initial-sync';
import { useOfflineQueue, type UseOfflineQueueReturn } from '@/hooks/use-offline-queue';

interface SyncContextValue {
  /** Initial sync state and methods */
  initialSync: UseInitialSyncReturn;
  /** Offline queue state and methods */
  offlineQueue: UseOfflineQueueReturn;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: ReactNode;
}

/**
 * SyncProvider manages all synchronization between local SQLite and Convex.
 *
 * Features:
 * - Triggers initial sync when user authenticates
 * - Monitors network connectivity and syncs when coming back online
 * - Syncs when app returns from background with pending changes
 * - Provides sync state to the entire app
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const initialSync = useInitialSync();
  const offlineQueue = useOfflineQueue();

  const hasTriggeredInitialSyncRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  // Trigger initial sync when user becomes authenticated
  useEffect(() => {
    // Reset tracking when user changes
    if (user?._id !== previousUserIdRef.current) {
      hasTriggeredInitialSyncRef.current = false;
      previousUserIdRef.current = user?._id ?? null;
    }

    // Trigger initial sync if authenticated and hasn't been done yet
    if (
      isAuthenticated &&
      user &&
      !hasTriggeredInitialSyncRef.current &&
      !initialSync.hasCompletedInitialSync &&
      !initialSync.isSyncing
    ) {
      hasTriggeredInitialSyncRef.current = true;
      console.log('[SyncProvider] Triggering initial sync...');
      initialSync.triggerInitialSync();
    }
  }, [isAuthenticated, user, initialSync.hasCompletedInitialSync, initialSync.isSyncing]);

  // Log sync status changes for debugging
  useEffect(() => {
    if (initialSync.hasCompletedInitialSync) {
      console.log('[SyncProvider] Initial sync completed');
    }
  }, [initialSync.hasCompletedInitialSync]);

  useEffect(() => {
    if (offlineQueue.lastSyncResult) {
      const { success, pushed, pulled, errors } = offlineQueue.lastSyncResult;
      if (success) {
        console.log(`[SyncProvider] Sync completed: pushed ${pushed}, pulled ${pulled}`);
      } else {
        console.log('[SyncProvider] Sync failed:', errors);
      }
    }
  }, [offlineQueue.lastSyncResult]);

  return (
    <SyncContext.Provider value={{ initialSync, offlineQueue }}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Hook to access sync state and methods.
 */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

/**
 * Hook that returns just the sync status for UI display.
 */
export function useSyncStatus() {
  const { initialSync, offlineQueue } = useSync();

  return {
    isOnline: offlineQueue.isOnline,
    isSyncing: initialSync.isSyncing || offlineQueue.isSyncing,
    hasCompletedInitialSync: initialSync.hasCompletedInitialSync,
    pendingCount: offlineQueue.pendingCount,
    hasPendingChanges: offlineQueue.hasPendingChanges,
    error: initialSync.error || offlineQueue.error,
    triggerSync: offlineQueue.triggerSync,
  };
}
