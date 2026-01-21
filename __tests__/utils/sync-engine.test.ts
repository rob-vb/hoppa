/**
 * Offline Scenarios Tests for Sync Engine
 *
 * Tests cover:
 * - Queue operations (add, remove, deduplication, persistence)
 * - ID mapping store (local <-> Convex ID mapping)
 * - Conflict resolution (last-write-wins)
 * - Sync operations (push, pull, full sync)
 * - Error handling and retry logic
 * - Dependency ordering for push operations
 */

// Mock database
jest.mock('@/db/database');

// Unmock sync-engine since we want to test the real implementation
// (it's mocked globally in jest.setup.js)
jest.unmock('@/utils/sync-engine');

import {
  SyncEngine,
  resolveConflict,
  SyncQueueItem,
  SyncEntityType,
  SyncState,
} from '@/utils/sync-engine';
import * as SecureStore from 'expo-secure-store';
import * as db from '@/db/database';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('Sync Engine - Offline Scenarios', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset SecureStore mocks
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockedSecureStore.setItemAsync.mockResolvedValue();
    mockedSecureStore.deleteItemAsync.mockResolvedValue();
    // Create fresh sync engine instance
    syncEngine = new SyncEngine();
  });

  describe('resolveConflict', () => {
    it('should return remote as winner when remote is newer', () => {
      const localTime = 1000;
      const remoteTime = 2000;

      const result = resolveConflict(localTime, remoteTime);

      expect(result.winner).toBe('remote');
      expect(result.localTimestamp).toBe(localTime);
      expect(result.remoteTimestamp).toBe(remoteTime);
    });

    it('should return local as winner when local is newer', () => {
      const localTime = 2000;
      const remoteTime = 1000;

      const result = resolveConflict(localTime, remoteTime);

      expect(result.winner).toBe('local');
      expect(result.localTimestamp).toBe(localTime);
      expect(result.remoteTimestamp).toBe(remoteTime);
    });

    it('should return local as winner when timestamps are equal', () => {
      const timestamp = 1000;

      const result = resolveConflict(timestamp, timestamp);

      expect(result.winner).toBe('local');
    });
  });

  describe('SyncQueue Operations', () => {
    it('should queue create operations', async () => {
      const mockClient = {
        mutation: jest.fn(),
        query: jest.fn(),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test Schema',
        progressiveLoadingEnabled: true,
      });

      expect(syncEngine.getPendingCount()).toBe(1);
      expect(syncEngine.hasPendingChanges()).toBe(true);
    });

    it('should queue update operations', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueUpdate('schema', 'schema-1', {
        name: 'Updated Schema',
      });

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should queue delete operations', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueDelete('schema', 'schema-1');

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should deduplicate operations for same entity and operation', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueUpdate('schema', 'schema-1', { name: 'First' });
      await syncEngine.queueUpdate('schema', 'schema-1', { name: 'Second' });

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should not deduplicate different operations for same entity', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'New' });
      await syncEngine.queueUpdate('schema', 'schema-1', { name: 'Updated' });

      expect(syncEngine.getPendingCount()).toBe(2);
    });

    it('should persist queue to SecureStore', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test' });

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'hoppa_sync_queue',
        expect.any(String)
      );
    });

    it('should load queue from SecureStore on initialization', async () => {
      const existingQueue: SyncQueueItem[] = [
        {
          id: 'item-1',
          entityType: 'schema',
          entityId: 'schema-1',
          operation: 'create',
          payload: { name: 'Test' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(existingQueue));

      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should handle corrupted queue data gracefully', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('invalid json');

      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      expect(syncEngine.getPendingCount()).toBe(0);
    });
  });

  describe('ID Mapping Store', () => {
    it('should set and get ID mappings', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');

      expect(syncEngine.getIdMapping('local-1')).toBe('convex-1');
      expect(syncEngine.hasMapping('local-1')).toBe(true);
    });

    it('should support reverse lookup (Convex ID to local ID)', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');

      expect(syncEngine.getLocalIdFromConvex('convex-1')).toBe('local-1');
      expect(syncEngine.hasConvexIdMapping('convex-1')).toBe(true);
    });

    it('should remove ID mappings', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');
      await syncEngine.removeIdMapping('local-1');

      expect(syncEngine.getIdMapping('local-1')).toBeUndefined();
      expect(syncEngine.hasMapping('local-1')).toBe(false);
    });

    it('should persist mappings to SecureStore', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'hoppa_id_mappings',
        expect.any(String)
      );
    });

    it('should load mappings from SecureStore on initialization', async () => {
      const existingMappings = [
        {
          localId: 'local-1',
          convexId: 'convex-1',
          entityType: 'schema',
          createdAt: Date.now(),
        },
      ];
      mockedSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'hoppa_id_mappings') {
          return Promise.resolve(JSON.stringify(existingMappings));
        }
        return Promise.resolve(null);
      });

      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      expect(syncEngine.getIdMapping('local-1')).toBe('convex-1');
    });
  });

  describe('Sync State Management', () => {
    it('should initialize with idle state', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const state = syncEngine.getState();

      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.pendingOperations).toBe(0);
    });

    it('should notify listeners of state changes', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const listener = jest.fn();
      syncEngine.subscribe(listener);

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test' });

      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall.pendingOperations).toBe(1);
    });

    it('should allow unsubscribing from state changes', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const listener = jest.fn();
      const unsubscribe = syncEngine.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test' });

      // Should not be called after unsubscribe (except initial call)
      expect(listener).not.toHaveBeenCalled();
    });

    it('should update pending operations count', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test1' });
      expect(syncEngine.getState().pendingOperations).toBe(1);

      await syncEngine.queueCreate('schema', 'schema-2', { name: 'Test2' });
      expect(syncEngine.getState().pendingOperations).toBe(2);
    });
  });

  describe('Sync Operations', () => {
    it('should return error when not initialized', async () => {
      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Not initialized');
    });

    it('should prevent concurrent sync operations', async () => {
      const mockClient = {
        mutation: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        query: jest.fn(),
      };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test' });

      // Start first sync (will hang)
      const firstSync = syncEngine.sync();

      // Immediately try second sync
      const secondResult = await syncEngine.sync();

      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain('Sync already in progress');
    });

    it('should update state to syncing during sync', async () => {
      let statesDurringSync: SyncState[] = [];
      const mockClient = {
        mutation: jest.fn().mockImplementation(async () => {
          statesDurringSync.push(syncEngine.getState());
          return 'convex-id';
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      await syncEngine.sync();

      expect(statesDurringSync.some((s) => s.status === 'syncing')).toBe(true);
    });

    it('should update lastSyncAt after successful sync', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      const beforeSync = Date.now();
      await syncEngine.sync();
      const afterSync = Date.now();

      const state = syncEngine.getState();
      expect(state.lastSyncAt).toBeGreaterThanOrEqual(beforeSync);
      expect(state.lastSyncAt).toBeLessThanOrEqual(afterSync);
    });
  });

  describe('Reset', () => {
    it('should clear all data on reset', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', { name: 'Test' });
      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');

      await syncEngine.reset();

      expect(syncEngine.getPendingCount()).toBe(0);
      expect(syncEngine.hasMapping('local-1')).toBe(false);
      expect(syncEngine.getState().status).toBe('idle');
    });

    it('should clear SecureStore on reset', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.reset();

      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('hoppa_sync_queue');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('hoppa_id_mappings');
    });
  });

  describe('Queue Retry Logic', () => {
    it('should track retry count for failed operations', async () => {
      const mockClient = {
        mutation: jest.fn().mockRejectedValue(new Error('Network error')),
        query: jest.fn().mockResolvedValue([]),
      };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      // First sync attempt - should fail
      await syncEngine.sync();

      // Item should still be in queue with incremented retry count
      expect(syncEngine.getPendingCount()).toBe(1);
    });
  });

  describe('Dependency Ordering', () => {
    it('should process schemas before workout days', async () => {
      const callOrder: string[] = [];
      const mockClient = {
        mutation: jest.fn().mockImplementation((name, args) => {
          callOrder.push(name);
          return Promise.resolve('convex-id');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Add in reverse order
      await syncEngine.queueCreate('workoutDay', 'day-1', {
        schemaId: 'schema-1',
        name: 'Day A',
        orderIndex: 0,
      });
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      // Set up mapping so workout day can find its parent
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');

      await syncEngine.sync();

      // Schema should be processed first
      const schemaIndex = callOrder.findIndex((c) => c.includes('schemas'));
      const dayIndex = callOrder.findIndex((c) => c.includes('workoutDays'));

      if (schemaIndex !== -1 && dayIndex !== -1) {
        expect(schemaIndex).toBeLessThan(dayIndex);
      }
    });

    it('should process workout days before exercises', async () => {
      const callOrder: string[] = [];
      const mockClient = {
        mutation: jest.fn().mockImplementation((name, args) => {
          callOrder.push(name);
          return Promise.resolve('convex-id');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Add in reverse order
      await syncEngine.queueCreate('exercise', 'ex-1', {
        dayId: 'day-1',
        name: 'Bench Press',
        equipmentType: 'plates',
        baseWeight: 20,
        targetSets: 3,
        targetRepsMin: 5,
        targetRepsMax: 7,
        progressiveLoadingEnabled: true,
        progressionIncrement: 2.5,
        orderIndex: 0,
      });
      await syncEngine.queueCreate('workoutDay', 'day-1', {
        schemaId: 'schema-1',
        name: 'Day A',
        orderIndex: 0,
      });

      // Set up mappings
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');
      await syncEngine.setIdMapping('day-1', 'convex-day-1', 'workoutDay');

      await syncEngine.sync();

      const dayIndex = callOrder.findIndex((c) => c.includes('workoutDays'));
      const exerciseIndex = callOrder.findIndex((c) => c.includes('exercises'));

      if (dayIndex !== -1 && exerciseIndex !== -1) {
        expect(dayIndex).toBeLessThan(exerciseIndex);
      }
    });

    it('should process creates before updates for same entity type', async () => {
      const callOrder: string[] = [];
      const mockClient = {
        mutation: jest.fn().mockImplementation((name) => {
          callOrder.push(name);
          return Promise.resolve('convex-id');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueUpdate('schema', 'schema-2', { name: 'Updated' });
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'New',
        progressiveLoadingEnabled: true,
      });

      // Set up mapping for update
      await syncEngine.setIdMapping('schema-2', 'convex-schema-2', 'schema');

      await syncEngine.sync();

      const createIndex = callOrder.findIndex((c) => c === 'schemas:create');
      const updateIndex = callOrder.findIndex((c) => c === 'schemas:update');

      if (createIndex !== -1 && updateIndex !== -1) {
        expect(createIndex).toBeLessThan(updateIndex);
      }
    });
  });

  describe('Offline Workflow Scenarios', () => {
    it('should queue operations when offline and sync when back online', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      // Initialize
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Simulate offline: queue multiple operations
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Offline Schema',
        progressiveLoadingEnabled: true,
      });
      await syncEngine.queueCreate('workoutDay', 'day-1', {
        schemaId: 'schema-1',
        name: 'Offline Day',
        orderIndex: 0,
      });
      await syncEngine.queueCreate('exercise', 'ex-1', {
        dayId: 'day-1',
        name: 'Offline Exercise',
        equipmentType: 'plates',
        baseWeight: 20,
        targetSets: 3,
        targetRepsMin: 5,
        targetRepsMax: 7,
        progressiveLoadingEnabled: true,
        progressionIncrement: 2.5,
        orderIndex: 0,
      });

      expect(syncEngine.getPendingCount()).toBe(3);

      // Simulate coming back online: sync
      await syncEngine.sync();

      // All creates should have been called
      expect(mockClient.mutation).toHaveBeenCalledWith(
        'schemas:create',
        expect.objectContaining({ name: 'Offline Schema' })
      );
    });

    it('should handle workout completion offline', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Set up existing mappings (synced before going offline)
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');
      await syncEngine.setIdMapping('day-1', 'convex-day-1', 'workoutDay');
      await syncEngine.setIdMapping('ex-1', 'convex-ex-1', 'exercise');

      // Simulate completing workout offline
      await syncEngine.queueCreate('workoutSession', 'session-1', {
        schemaId: 'schema-1',
        dayId: 'day-1',
        startedAt: Date.now() - 3600000,
        completedAt: Date.now(),
        status: 'completed',
      });

      await syncEngine.queueCreate('exerciseLog', 'log-1', {
        sessionId: 'session-1',
        exerciseId: 'ex-1',
        status: 'completed',
        microplateUsed: 0,
        totalWeight: 60,
        progressionEarned: true,
        updatedAt: Date.now(),
      });

      await syncEngine.queueCreate('setLog', 'set-1', {
        exerciseLogId: 'log-1',
        setNumber: 1,
        targetReps: '5-7',
        completedReps: 7,
        updatedAt: Date.now(),
      });

      expect(syncEngine.getPendingCount()).toBe(3);
      expect(syncEngine.hasPendingChanges()).toBe(true);
    });

    it('should persist changes across app restarts', async () => {
      // First session: create and queue
      const mockClient1 = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient1 as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Persisted Schema',
        progressiveLoadingEnabled: true,
      });
      await syncEngine.setIdMapping('existing-1', 'convex-existing-1', 'schema');

      // Capture what was saved
      const savedQueue = JSON.parse(
        (mockedSecureStore.setItemAsync.mock.calls.find(
          (c) => c[0] === 'hoppa_sync_queue'
        )?.[1] as string) || '[]'
      );
      const savedMappings = JSON.parse(
        (mockedSecureStore.setItemAsync.mock.calls.find(
          (c) => c[0] === 'hoppa_id_mappings'
        )?.[1] as string) || '[]'
      );

      // Reset and simulate app restart
      await syncEngine.reset();
      jest.clearAllMocks();

      // Set up SecureStore to return saved data
      mockedSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'hoppa_sync_queue') return Promise.resolve(JSON.stringify(savedQueue));
        if (key === 'hoppa_id_mappings') return Promise.resolve(JSON.stringify(savedMappings));
        return Promise.resolve(null);
      });

      // Second session: should load persisted data
      const newEngine = new SyncEngine();
      const mockClient2 = { mutation: jest.fn(), query: jest.fn() };
      await newEngine.initialize(mockClient2 as any, 'user-123' as any);

      expect(newEngine.getPendingCount()).toBe(1);
      expect(newEngine.hasMapping('existing-1')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error state on sync failure', async () => {
      const mockClient = {
        mutation: jest.fn().mockRejectedValue(new Error('Network timeout')),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue syncing other items when one fails', async () => {
      let callCount = 0;
      const mockClient = {
        mutation: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('First item failed'));
          }
          return Promise.resolve('convex-id');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Schema 1',
        progressiveLoadingEnabled: true,
      });
      await syncEngine.queueCreate('schema', 'schema-2', {
        name: 'Schema 2',
        progressiveLoadingEnabled: true,
      });

      const result = await syncEngine.sync();

      // Both should have been attempted
      expect(mockClient.mutation).toHaveBeenCalledTimes(2);
      expect(result.pushed).toBe(1); // One succeeded
      // At least one error from the failed push
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.includes('First item failed'))).toBe(true);
    });

    it('should handle SecureStore errors gracefully', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const mockClient = { mutation: jest.fn(), query: jest.fn() };

      // Should not throw
      await expect(syncEngine.initialize(mockClient as any, 'user-123' as any)).resolves.not.toThrow();

      // Should be in a valid state
      expect(syncEngine.getPendingCount()).toBe(0);
    });
  });

  describe('Full Sync', () => {
    it('should return error when not initialized', async () => {
      const result = await syncEngine.fullSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Not initialized');
    });

    it('should push unmapped local data during full sync', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      mockedDb.getSchemas.mockResolvedValue([
        {
          id: 'local-schema-1',
          name: 'Local Schema',
          progressiveLoadingEnabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      mockedDb.getSchemaWithDays.mockResolvedValue({
        id: 'local-schema-1',
        name: 'Local Schema',
        progressiveLoadingEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        days: [],
      });
      mockedDb.getWorkoutSessions.mockResolvedValue([]);

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const result = await syncEngine.fullSync();

      expect(mockClient.mutation).toHaveBeenCalledWith(
        'schemas:create',
        expect.objectContaining({ name: 'Local Schema' })
      );
      expect(result.pushed).toBeGreaterThan(0);
    });
  });
});
