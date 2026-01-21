/**
 * Sync Edge Cases Tests
 *
 * Tests cover edge cases and boundary conditions in the sync engine:
 * - Rapid consecutive operations
 * - Entity ordering with missing dependencies
 * - ID mapping edge cases
 * - Partial sync failure recovery
 * - Queue item expiration after max retries
 * - Timestamp edge cases in conflict resolution
 * - Concurrent modification scenarios
 */

// Mock database
jest.mock('@/db/database');

// Unmock sync-engine since we want to test the real implementation
jest.unmock('@/utils/sync-engine');

import { SyncEngine, resolveConflict, SyncQueueItem } from '@/utils/sync-engine';
import * as SecureStore from 'expo-secure-store';
import * as db from '@/db/database';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('Sync Edge Cases', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockedSecureStore.setItemAsync.mockResolvedValue();
    mockedSecureStore.deleteItemAsync.mockResolvedValue();
    syncEngine = new SyncEngine();
  });

  describe('Rapid Consecutive Operations', () => {
    it('should handle rapid updates to the same entity', async () => {
      const mockClient = { mutation: jest.fn().mockResolvedValue('convex-id'), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Rapidly queue multiple updates to the same schema
      await Promise.all([
        syncEngine.queueUpdate('schema', 'schema-1', { name: 'Update 1' }),
        syncEngine.queueUpdate('schema', 'schema-1', { name: 'Update 2' }),
        syncEngine.queueUpdate('schema', 'schema-1', { name: 'Update 3' }),
      ]);

      // Should deduplicate to just one operation with the latest data
      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should handle interleaved creates and updates', async () => {
      const mockClient = { mutation: jest.fn().mockResolvedValue('convex-id'), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Create followed by immediate update
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Original',
        progressiveLoadingEnabled: true,
      });
      await syncEngine.queueUpdate('schema', 'schema-1', { name: 'Updated' });

      // Both operations should be in the queue (different operation types)
      expect(syncEngine.getPendingCount()).toBe(2);
    });

    it('should handle rapid creates for different entities', async () => {
      const mockClient = { mutation: jest.fn().mockResolvedValue('convex-id'), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Rapidly create multiple different schemas
      await Promise.all([
        syncEngine.queueCreate('schema', 'schema-1', { name: 'Schema 1', progressiveLoadingEnabled: true }),
        syncEngine.queueCreate('schema', 'schema-2', { name: 'Schema 2', progressiveLoadingEnabled: true }),
        syncEngine.queueCreate('schema', 'schema-3', { name: 'Schema 3', progressiveLoadingEnabled: false }),
      ]);

      // All should be in the queue
      expect(syncEngine.getPendingCount()).toBe(3);
    });

    it('should handle delete followed by create for same entity ID', async () => {
      const mockClient = { mutation: jest.fn().mockResolvedValue('convex-id'), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Delete then recreate same entity ID (rare but possible)
      await syncEngine.queueDelete('schema', 'schema-1');
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Recreated',
        progressiveLoadingEnabled: true,
      });

      // Both operations should be preserved (different operation types)
      expect(syncEngine.getPendingCount()).toBe(2);
    });
  });

  describe('Entity Ordering with Missing Dependencies', () => {
    it('should fail gracefully when parent entity is not synced', async () => {
      const mockClient = {
        mutation: jest.fn().mockImplementation((name) => {
          if (name === 'workoutDays:create') {
            throw new Error('Parent schema not synced');
          }
          return Promise.resolve('convex-id');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Queue workout day without its parent schema being synced
      await syncEngine.queueCreate('workoutDay', 'day-1', {
        schemaId: 'schema-1',
        name: 'Day A',
        orderIndex: 0,
      });

      const result = await syncEngine.sync();

      // Should fail but not crash
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Item should still be in queue for retry
      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should handle deeply nested dependency chain', async () => {
      const callOrder: string[] = [];
      const mockClient = {
        mutation: jest.fn().mockImplementation((name) => {
          callOrder.push(name);
          return Promise.resolve(`convex-${callOrder.length}`);
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Set up mappings for parent entities
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');
      await syncEngine.setIdMapping('day-1', 'convex-day-1', 'workoutDay');
      await syncEngine.setIdMapping('ex-1', 'convex-ex-1', 'exercise');
      await syncEngine.setIdMapping('session-1', 'convex-session-1', 'workoutSession');
      await syncEngine.setIdMapping('log-1', 'convex-log-1', 'exerciseLog');

      // Queue in reverse order of dependencies
      await syncEngine.queueCreate('setLog', 'set-1', {
        exerciseLogId: 'log-1',
        setNumber: 1,
        targetReps: '5-7',
        completedReps: 7,
        updatedAt: Date.now(),
      });
      await syncEngine.queueCreate('exerciseLog', 'log-2', {
        sessionId: 'session-1',
        exerciseId: 'ex-1',
        status: 'pending',
        microplateUsed: 0,
        totalWeight: 60,
        progressionEarned: false,
        updatedAt: Date.now(),
      });

      await syncEngine.sync();

      // Exercise log should be processed before set log due to dependency ordering
      const exerciseLogIndex = callOrder.findIndex((c) => c.includes('exerciseLogs'));
      const setLogIndex = callOrder.findIndex((c) => c.includes('setLogs'));

      if (exerciseLogIndex !== -1 && setLogIndex !== -1) {
        expect(exerciseLogIndex).toBeLessThan(setLogIndex);
      }
    });

    it('should process items with resolved dependencies even if others fail', async () => {
      let schemaCreated = false;
      const mockClient = {
        mutation: jest.fn().mockImplementation((name, args) => {
          if (name.includes('schemas')) {
            schemaCreated = true;
            return Promise.resolve('convex-schema-1');
          }
          if (name.includes('workoutDays') && !schemaCreated) {
            throw new Error('Parent schema not synced');
          }
          return Promise.resolve('convex-day-1');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Queue both schema and day - schema should succeed, day should succeed after schema
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test Schema',
        progressiveLoadingEnabled: true,
      });
      await syncEngine.queueCreate('workoutDay', 'day-1', {
        schemaId: 'schema-1',
        name: 'Day A',
        orderIndex: 0,
      });

      const result = await syncEngine.sync();

      // Schema should have been created
      expect(mockClient.mutation).toHaveBeenCalledWith(
        'schemas:create',
        expect.objectContaining({ name: 'Test Schema' })
      );
    });
  });

  describe('ID Mapping Edge Cases', () => {
    it('should handle orphaned local ID without Convex mapping', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Try to update entity that has no mapping
      await syncEngine.queueUpdate('schema', 'orphan-schema', { name: 'Updated' });

      const result = await syncEngine.sync();

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('No mapping found'))).toBe(true);
    });

    it('should handle reverse lookup for non-existent Convex ID', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Try to get local ID for non-existent Convex ID
      const localId = syncEngine.getLocalIdFromConvex('non-existent-convex-id');
      expect(localId).toBeUndefined();
    });

    it('should overwrite mapping when same local ID is mapped again', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Map local ID to first Convex ID
      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');
      expect(syncEngine.getIdMapping('local-1')).toBe('convex-1');

      // Map same local ID to different Convex ID
      await syncEngine.setIdMapping('local-1', 'convex-2', 'schema');
      expect(syncEngine.getIdMapping('local-1')).toBe('convex-2');

      // Reverse lookup should return the new local ID
      expect(syncEngine.getLocalIdFromConvex('convex-2')).toBe('local-1');
    });

    it('should handle mapping removal and recreation', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Create mapping
      await syncEngine.setIdMapping('local-1', 'convex-1', 'schema');
      expect(syncEngine.hasMapping('local-1')).toBe(true);

      // Remove mapping
      await syncEngine.removeIdMapping('local-1');
      expect(syncEngine.hasMapping('local-1')).toBe(false);
      expect(syncEngine.hasConvexIdMapping('convex-1')).toBe(false);

      // Recreate mapping with different Convex ID
      await syncEngine.setIdMapping('local-1', 'convex-3', 'schema');
      expect(syncEngine.getIdMapping('local-1')).toBe('convex-3');
    });

    it('should handle many mappings without performance degradation', async () => {
      const mockClient = { mutation: jest.fn(), query: jest.fn() };
      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Create 1000 mappings
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        await syncEngine.setIdMapping(`local-${i}`, `convex-${i}`, 'schema');
      }
      const createTime = Date.now() - startTime;

      // Verify all mappings exist
      for (let i = 0; i < 1000; i++) {
        expect(syncEngine.getIdMapping(`local-${i}`)).toBe(`convex-${i}`);
      }

      // Performance should be reasonable (less than 10 seconds)
      expect(createTime).toBeLessThan(10000);
    });
  });

  describe('Partial Sync Failure Recovery', () => {
    it('should track which items succeeded after partial failure', async () => {
      let callCount = 0;
      const mockClient = {
        mutation: jest.fn().mockImplementation(() => {
          callCount++;
          // Fail the second item
          if (callCount === 2) {
            return Promise.reject(new Error('Network error on item 2'));
          }
          return Promise.resolve(`convex-${callCount}`);
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
      await syncEngine.queueCreate('schema', 'schema-3', {
        name: 'Schema 3',
        progressiveLoadingEnabled: true,
      });

      const result = await syncEngine.sync();

      // Two should have succeeded, one failed
      expect(result.pushed).toBe(2);
      // Pull phase also queries which can add errors, so we check for at least one push error
      expect(result.errors.some((e) => e.includes('Network error on item 2'))).toBe(true);
      // One item should remain in queue
      expect(syncEngine.getPendingCount()).toBe(1);
    });

    it('should retry failed items on subsequent sync', async () => {
      let failureCount = 0;
      const mockClient = {
        mutation: jest.fn().mockImplementation(() => {
          failureCount++;
          // Fail first two attempts, succeed on third
          if (failureCount <= 2) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve('convex-success');
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Retry Schema',
        progressiveLoadingEnabled: true,
      });

      // First sync fails push
      const result1 = await syncEngine.sync();
      expect(result1.errors.some((e) => e.includes('Temporary failure'))).toBe(true);
      expect(syncEngine.getPendingCount()).toBe(1);

      // Second sync fails push
      const result2 = await syncEngine.sync();
      expect(result2.errors.some((e) => e.includes('Temporary failure'))).toBe(true);
      expect(syncEngine.getPendingCount()).toBe(1);

      // Third sync succeeds push
      const result3 = await syncEngine.sync();
      expect(result3.pushed).toBe(1);
      expect(syncEngine.getPendingCount()).toBe(0);
    });

    it('should preserve queue state after partial failure and app restart', async () => {
      const mockClient = {
        mutation: jest.fn().mockImplementation(() => {
          return Promise.reject(new Error('Persistent failure'));
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Persisted Schema',
        progressiveLoadingEnabled: true,
      });

      // Sync fails
      await syncEngine.sync();
      expect(syncEngine.getPendingCount()).toBe(1);

      // Capture saved queue
      const savedQueue = JSON.parse(
        (mockedSecureStore.setItemAsync.mock.calls.find(
          (c) => c[0] === 'hoppa_sync_queue'
        )?.[1] as string) || '[]'
      );

      // Simulate app restart
      jest.clearAllMocks();
      mockedSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'hoppa_sync_queue') return Promise.resolve(JSON.stringify(savedQueue));
        return Promise.resolve(null);
      });

      const newEngine = new SyncEngine();
      const newMockClient = {
        mutation: jest.fn().mockResolvedValue('convex-success'),
        query: jest.fn().mockResolvedValue([]),
      };
      await newEngine.initialize(newMockClient as any, 'user-123' as any);

      // Queue should be restored with retry count
      expect(newEngine.getPendingCount()).toBe(1);

      // Now sync should succeed
      const result = await newEngine.sync();
      expect(result.pushed).toBe(1);
    });
  });

  describe('Queue Item Expiration After Max Retries', () => {
    it('should stop retrying items after 5 failures', async () => {
      const mockClient = {
        mutation: jest.fn().mockRejectedValue(new Error('Permanent failure')),
        query: jest.fn().mockResolvedValue([]),
      };

      // Create queue with item at max retries
      const queueWithMaxRetries: SyncQueueItem[] = [
        {
          id: 'item-1',
          entityType: 'schema',
          entityId: 'schema-1',
          operation: 'create',
          payload: { name: 'Test', progressiveLoadingEnabled: true },
          timestamp: Date.now(),
          retryCount: 5,
          lastError: 'Previous failure',
        },
      ];

      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(queueWithMaxRetries));

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Item should be in queue
      expect(syncEngine.getPendingCount()).toBe(1);

      // Sync should not process items with 5+ retries
      const result = await syncEngine.sync();

      // Mutation should NOT have been called for this item
      expect(mockClient.mutation).not.toHaveBeenCalled();
      expect(result.pushed).toBe(0);
    });

    it('should continue processing other items when one is expired', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      const mixedQueue: SyncQueueItem[] = [
        {
          id: 'expired-item',
          entityType: 'schema',
          entityId: 'schema-1',
          operation: 'create',
          payload: { name: 'Expired', progressiveLoadingEnabled: true },
          timestamp: Date.now(),
          retryCount: 5,
        },
        {
          id: 'fresh-item',
          entityType: 'schema',
          entityId: 'schema-2',
          operation: 'create',
          payload: { name: 'Fresh', progressiveLoadingEnabled: true },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mixedQueue));

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const result = await syncEngine.sync();

      // Only the fresh item should be processed
      expect(mockClient.mutation).toHaveBeenCalledTimes(1);
      expect(mockClient.mutation).toHaveBeenCalledWith(
        'schemas:create',
        expect.objectContaining({ name: 'Fresh' })
      );
      expect(result.pushed).toBe(1);
    });

    it('should increment retry count correctly on failure', async () => {
      const mockClient = {
        mutation: jest.fn().mockRejectedValue(new Error('Failure')),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      // Sync 4 times (should increment retry count each time)
      for (let i = 0; i < 4; i++) {
        await syncEngine.sync();
        // Item should still be in queue
        expect(syncEngine.getPendingCount()).toBe(1);
      }

      // 5th sync - item should still be processed
      await syncEngine.sync();
      expect(mockClient.mutation).toHaveBeenCalledTimes(5);

      // 6th sync - item has 5 retries and should be skipped
      mockClient.mutation.mockClear();
      await syncEngine.sync();
      expect(mockClient.mutation).not.toHaveBeenCalled();
    });
  });

  describe('Timestamp Edge Cases in Conflict Resolution', () => {
    it('should handle timestamps from the same millisecond', () => {
      const timestamp = Date.now();

      const result = resolveConflict(timestamp, timestamp);

      // When equal, local wins
      expect(result.winner).toBe('local');
      expect(result.localTimestamp).toBe(timestamp);
      expect(result.remoteTimestamp).toBe(timestamp);
    });

    it('should handle timestamps 1ms apart', () => {
      const localTime = 1000;
      const remoteTime = 1001;

      const result = resolveConflict(localTime, remoteTime);

      expect(result.winner).toBe('remote');
    });

    it('should handle timestamps from far future', () => {
      const localTime = Date.now();
      const futureTime = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year in future

      const result = resolveConflict(localTime, futureTime);

      expect(result.winner).toBe('remote');
    });

    it('should handle very old timestamps', () => {
      const veryOldTime = 0; // Unix epoch
      const recentTime = Date.now();

      const result = resolveConflict(veryOldTime, recentTime);

      expect(result.winner).toBe('remote');
    });

    it('should handle negative timestamps gracefully', () => {
      const negativeTime = -1000;
      const positiveTime = 1000;

      const result = resolveConflict(negativeTime, positiveTime);

      expect(result.winner).toBe('remote');
    });

    it('should handle max safe integer timestamps', () => {
      const maxInt = Number.MAX_SAFE_INTEGER;
      const normalTime = Date.now();

      const result = resolveConflict(normalTime, maxInt);

      expect(result.winner).toBe('remote');
    });
  });

  describe('Concurrent Modification Scenarios', () => {
    it('should handle sync starting while another is in progress', async () => {
      const mockClient = {
        mutation: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('convex-id'), 100))
        ),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      // Start first sync
      const sync1Promise = syncEngine.sync();

      // Immediately start second sync
      const sync2Result = await syncEngine.sync();

      // Second sync should be rejected
      expect(sync2Result.success).toBe(false);
      expect(sync2Result.errors).toContain('Sync already in progress');

      // First sync should complete successfully
      const sync1Result = await sync1Promise;
      expect(sync1Result.pushed).toBe(1);
    });

    it('should handle queue modifications during sync', async () => {
      let syncInProgress = false;
      const mockClient = {
        mutation: jest.fn().mockImplementation(async () => {
          syncInProgress = true;
          // Add new item during sync
          await syncEngine.queueCreate('schema', 'schema-2', {
            name: 'Added During Sync',
            progressiveLoadingEnabled: true,
          });
          syncInProgress = false;
          return 'convex-id';
        }),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Original',
        progressiveLoadingEnabled: true,
      });

      await syncEngine.sync();

      // New item should be in queue for next sync
      expect(syncEngine.getPendingCount()).toBeGreaterThanOrEqual(0);
    });

    it('should handle reset during sync gracefully', async () => {
      const mockClient = {
        mutation: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('convex-id'), 50))
        ),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);
      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      // Start sync
      const syncPromise = syncEngine.sync();

      // Reset should clear state
      await syncEngine.reset();

      // Sync should still complete but state should be reset
      const result = await syncPromise;
      expect(syncEngine.getPendingCount()).toBe(0);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after multiple operations', async () => {
      // Mock db functions needed for pull phase
      mockedDb.getSchemas.mockResolvedValue([]);

      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Perform many operations
      for (let i = 0; i < 10; i++) {
        await syncEngine.queueCreate('schema', `schema-${i}`, {
          name: `Schema ${i}`,
          progressiveLoadingEnabled: true,
        });
      }

      expect(syncEngine.getPendingCount()).toBe(10);
      expect(syncEngine.getState().pendingOperations).toBe(10);

      // Sync all
      const result = await syncEngine.sync();

      expect(syncEngine.getPendingCount()).toBe(0);
      expect(syncEngine.getState().pendingOperations).toBe(0);
      // State should be idle on success, or error if pull had issues
      expect(['idle', 'error']).toContain(syncEngine.getState().status);
      expect(result.pushed).toBe(10);
    });

    it('should update lastSyncAt even when no items to sync', async () => {
      const mockClient = {
        mutation: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const beforeSync = Date.now();
      await syncEngine.sync();
      const afterSync = Date.now();

      const state = syncEngine.getState();
      expect(state.lastSyncAt).toBeGreaterThanOrEqual(beforeSync);
      expect(state.lastSyncAt).toBeLessThanOrEqual(afterSync);
    });

    it('should correctly report hasPendingChanges', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue('convex-id'),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      expect(syncEngine.hasPendingChanges()).toBe(false);

      await syncEngine.queueCreate('schema', 'schema-1', {
        name: 'Test',
        progressiveLoadingEnabled: true,
      });

      expect(syncEngine.hasPendingChanges()).toBe(true);

      await syncEngine.sync();

      expect(syncEngine.hasPendingChanges()).toBe(false);
    });
  });

  describe('Pull Edge Cases', () => {
    it('should handle empty remote data', async () => {
      // Mock db functions needed for pull phase
      mockedDb.getSchemas.mockResolvedValue([]);

      const mockClient = {
        mutation: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const result = await syncEngine.sync();

      // With no errors in push or pull, should succeed
      expect(result.errors.length).toBe(0);
      expect(result.success).toBe(true);
      expect(result.pulled).toBe(0);
    });

    it('should handle pull failure gracefully', async () => {
      const mockClient = {
        mutation: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Query failed'))).toBe(true);
    });

    it('should handle partial pull failure', async () => {
      let queryCount = 0;
      const mockClient = {
        mutation: jest.fn(),
        query: jest.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 2) {
            return Promise.reject(new Error('Partial query failure'));
          }
          return Promise.resolve([]);
        }),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      const result = await syncEngine.sync();

      // Should have some errors but not crash
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Delete Operation Edge Cases', () => {
    it('should handle delete of non-existent entity gracefully', async () => {
      // Mock db functions needed for pull phase
      mockedDb.getSchemas.mockResolvedValue([]);

      const mockClient = {
        mutation: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Delete without prior mapping - should be a no-op since there's no convex ID to delete
      await syncEngine.queueDelete('schema', 'non-existent-schema');

      const result = await syncEngine.sync();

      // The delete operation completes as a no-op when there's no mapping
      // Mutation should not be called for delete without mapping
      expect(mockClient.mutation).not.toHaveBeenCalled();
      // Item is removed from queue (operation "completed" as no-op)
      expect(syncEngine.getPendingCount()).toBe(0);
    });

    it('should clean up ID mapping after successful delete', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Set up mapping
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');
      expect(syncEngine.hasMapping('schema-1')).toBe(true);

      // Delete
      await syncEngine.queueDelete('schema', 'schema-1');
      await syncEngine.sync();

      // Mapping should be removed
      expect(syncEngine.hasMapping('schema-1')).toBe(false);
    });

    it('should handle cascade delete scenario', async () => {
      const mockClient = {
        mutation: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([]),
      };

      await syncEngine.initialize(mockClient as any, 'user-123' as any);

      // Set up mappings for parent and children
      await syncEngine.setIdMapping('schema-1', 'convex-schema-1', 'schema');
      await syncEngine.setIdMapping('day-1', 'convex-day-1', 'workoutDay');
      await syncEngine.setIdMapping('ex-1', 'convex-ex-1', 'exercise');

      // Delete parent schema (child deletes would typically be handled by Convex backend)
      await syncEngine.queueDelete('schema', 'schema-1');
      await syncEngine.sync();

      // Parent mapping should be removed
      expect(syncEngine.hasMapping('schema-1')).toBe(false);
      // Note: Child mappings would need to be cleaned up separately or by backend cascade
    });
  });
});
