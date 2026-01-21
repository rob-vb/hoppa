/**
 * Sync Engine for Hoppa
 *
 * Handles bidirectional synchronization between local SQLite and Convex backend.
 * Implements offline-first architecture with eventual consistency.
 *
 * Key features:
 * - Offline queue for operations when network unavailable
 * - ID mapping between local UUIDs and Convex IDs
 * - Conflict resolution (last-write-wins with timestamp comparison)
 * - Selective sync (schemas, exercises, sessions)
 */

import { ConvexReactClient } from 'convex/react';
import { FunctionReference, FunctionReturnType } from 'convex/server';
import { Id } from '../convex/_generated/dataModel';
import { api } from '../convex/_generated/api';
import * as db from '@/db/database';
import * as SecureStore from 'expo-secure-store';
import {
  Schema,
  WorkoutDay,
  Exercise,
  WorkoutSession,
  ExerciseLog,
  SetLog,
  SchemaWithDays,
} from '@/db/types';

// ============================================
// Types
// ============================================

export type SyncEntityType =
  | 'schema'
  | 'workoutDay'
  | 'exercise'
  | 'workoutSession'
  | 'exerciseLog'
  | 'setLog';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export const MAX_RETRY_COUNT = 5;

export interface FailedSyncItem {
  item: SyncQueueItem;
  failedAt: number;
  reason: string;
}

export interface IdMapping {
  localId: string;
  convexId: string;
  entityType: SyncEntityType;
  createdAt: number;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingOperations: number;
  error: string | null;
  /** Number of permanently failed operations (exceeded max retries) */
  failedOperations: number;
  /** Storage errors that could lead to data loss */
  storageError: string | null;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'local-wins' | 'remote-wins' | 'last-write-wins';
  resolvedAt: number;
  entityType: SyncEntityType;
  entityId: string;
}

export interface ConflictResult {
  winner: 'local' | 'remote';
  localTimestamp: number;
  remoteTimestamp: number;
}

/**
 * Resolves a conflict between local and remote data using last-write-wins strategy.
 * Returns the winner based on timestamps.
 *
 * @param localUpdatedAt - Timestamp of the local record
 * @param remoteUpdatedAt - Timestamp of the remote record
 * @returns ConflictResult with the winner and both timestamps
 */
export function resolveConflict(localUpdatedAt: number, remoteUpdatedAt: number): ConflictResult {
  const winner = remoteUpdatedAt > localUpdatedAt ? 'remote' : 'local';
  return {
    winner,
    localTimestamp: localUpdatedAt,
    remoteTimestamp: remoteUpdatedAt,
  };
}

// ============================================
// Sync Queue (In-Memory with Persistence)
// ============================================

class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private failedItems: FailedSyncItem[] = [];
  private storageKey = 'hoppa_sync_queue';
  private failedStorageKey = 'hoppa_sync_failed';
  private isLoaded = false;
  private lastStorageError: string | null = null;

  async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const stored = await SecureStore.getItemAsync(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      } else {
        this.queue = [];
      }

      // Load failed items
      const failedStored = await SecureStore.getItemAsync(this.failedStorageKey);
      if (failedStored) {
        this.failedItems = JSON.parse(failedStored);
      } else {
        this.failedItems = [];
      }

      this.isLoaded = true;
      this.lastStorageError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      console.error('[SyncQueue] Failed to load queue from storage:', error);
      this.lastStorageError = `Failed to load queue: ${message}`;
      this.queue = [];
      this.failedItems = [];
      this.isLoaded = true;
    }
  }

  async save(): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.storageKey, JSON.stringify(this.queue));
      this.lastStorageError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      console.error('[SyncQueue] Failed to save queue to storage:', error);
      this.lastStorageError = `Failed to save queue: ${message}. Offline changes may be lost.`;
      throw new Error(this.lastStorageError);
    }
  }

  private async saveFailed(): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.failedStorageKey, JSON.stringify(this.failedItems));
    } catch (error) {
      console.error('[SyncQueue] Failed to save failed items:', error);
    }
  }

  getStorageError(): string | null {
    return this.lastStorageError;
  }

  async add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Deduplicate: if same entity + operation exists, update it
    const existingIndex = this.queue.findIndex(
      (q) =>
        q.entityType === item.entityType &&
        q.entityId === item.entityId &&
        q.operation === item.operation
    );

    if (existingIndex >= 0) {
      this.queue[existingIndex] = queueItem;
    } else {
      this.queue.push(queueItem);
    }

    await this.save();
  }

  async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((item) => item.id !== id);
    await this.save();
  }

  async markFailed(id: string, error: string): Promise<{ permanentlyFailed: boolean }> {
    const item = this.queue.find((q) => q.id === id);
    if (item) {
      item.retryCount++;
      item.lastError = error;

      // If max retries exceeded, move to failed items
      if (item.retryCount >= MAX_RETRY_COUNT) {
        const failedItem: FailedSyncItem = {
          item: { ...item },
          failedAt: Date.now(),
          reason: `Exceeded max retries (${MAX_RETRY_COUNT}). Last error: ${error}`,
        };
        this.failedItems.push(failedItem);
        this.queue = this.queue.filter((q) => q.id !== id);

        await this.save();
        await this.saveFailed();

        console.error(`[SyncQueue] Operation permanently failed: ${item.entityType}:${item.entityId}`, error);
        return { permanentlyFailed: true };
      }

      await this.save();
    }
    return { permanentlyFailed: false };
  }

  getAll(): SyncQueueItem[] {
    return [...this.queue];
  }

  getFailedItems(): FailedSyncItem[] {
    return [...this.failedItems];
  }

  getFailedCount(): number {
    return this.failedItems.length;
  }

  async clearFailedItems(): Promise<void> {
    this.failedItems = [];
    await this.saveFailed();
  }

  async retryFailedItem(failedItemId: string): Promise<boolean> {
    const index = this.failedItems.findIndex((f) => f.item.id === failedItemId);
    if (index === -1) return false;

    const failedItem = this.failedItems[index];
    // Reset retry count and add back to queue
    failedItem.item.retryCount = 0;
    failedItem.item.lastError = undefined;
    this.queue.push(failedItem.item);
    this.failedItems.splice(index, 1);

    await this.save();
    await this.saveFailed();
    return true;
  }

  getPending(): SyncQueueItem[] {
    // Return items with less than MAX_RETRY_COUNT retries
    return this.queue.filter((item) => item.retryCount < MAX_RETRY_COUNT);
  }

  getByEntity(entityType: SyncEntityType, entityId: string): SyncQueueItem | undefined {
    return this.queue.find((q) => q.entityType === entityType && q.entityId === entityId);
  }

  get length(): number {
    return this.queue.length;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.failedItems = [];
    this.isLoaded = false;
    this.lastStorageError = null;
    try {
      await SecureStore.deleteItemAsync(this.storageKey);
      await SecureStore.deleteItemAsync(this.failedStorageKey);
    } catch (error) {
      console.error('[SyncQueue] Failed to clear queue from storage:', error);
    }
  }
}

// ============================================
// ID Mapping Store
// ============================================

class IdMappingStore {
  private mappings: Map<string, IdMapping> = new Map();
  private reverseMap: Map<string, string> = new Map(); // convexId -> localId
  private storageKey = 'hoppa_id_mappings';
  private isLoaded = false;
  private lastStorageError: string | null = null;

  async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const stored = await SecureStore.getItemAsync(this.storageKey);
      if (stored) {
        const mappingsArray: IdMapping[] = JSON.parse(stored);
        this.mappings = new Map();
        this.reverseMap = new Map();
        for (const mapping of mappingsArray) {
          this.mappings.set(mapping.localId, mapping);
          this.reverseMap.set(mapping.convexId, mapping.localId);
        }
      } else {
        this.mappings = new Map();
        this.reverseMap = new Map();
      }
      this.isLoaded = true;
      this.lastStorageError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      console.error('[IdMappingStore] Failed to load mappings from storage:', error);
      this.lastStorageError = `Failed to load ID mappings: ${message}`;
      this.mappings = new Map();
      this.reverseMap = new Map();
      this.isLoaded = true;
    }
  }

  async save(): Promise<void> {
    try {
      const mappingsArray = Array.from(this.mappings.values());
      await SecureStore.setItemAsync(this.storageKey, JSON.stringify(mappingsArray));
      this.lastStorageError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      console.error('[IdMappingStore] Failed to save mappings to storage:', error);
      this.lastStorageError = `Failed to save ID mappings: ${message}. Sync may fail.`;
      throw new Error(this.lastStorageError);
    }
  }

  getStorageError(): string | null {
    return this.lastStorageError;
  }

  async set(localId: string, convexId: string, entityType: SyncEntityType): Promise<void> {
    const mapping: IdMapping = {
      localId,
      convexId,
      entityType,
      createdAt: Date.now(),
    };
    this.mappings.set(localId, mapping);
    this.reverseMap.set(convexId, localId);
    await this.save();
  }

  getConvexId(localId: string): string | undefined {
    return this.mappings.get(localId)?.convexId;
  }

  getLocalId(convexId: string): string | undefined {
    return this.reverseMap.get(convexId);
  }

  has(localId: string): boolean {
    return this.mappings.has(localId);
  }

  hasConvexId(convexId: string): boolean {
    return this.reverseMap.has(convexId);
  }

  async remove(localId: string): Promise<void> {
    const mapping = this.mappings.get(localId);
    if (mapping) {
      this.reverseMap.delete(mapping.convexId);
      this.mappings.delete(localId);
      await this.save();
    }
  }

  getByType(entityType: SyncEntityType): IdMapping[] {
    return Array.from(this.mappings.values()).filter((m) => m.entityType === entityType);
  }

  async clear(): Promise<void> {
    this.mappings = new Map();
    this.reverseMap = new Map();
    this.isLoaded = false;
    try {
      await SecureStore.deleteItemAsync(this.storageKey);
    } catch (error) {
      console.warn('[IdMappingStore] Failed to clear mappings from storage:', error);
    }
  }
}

// ============================================
// Sync Engine
// ============================================

export class SyncEngine {
  private client: ConvexReactClient | null = null;
  private userId: Id<'users'> | null = null;
  private queue: SyncQueue;
  private idMap: IdMappingStore;
  private state: SyncState = {
    status: 'idle',
    lastSyncAt: null,
    pendingOperations: 0,
    error: null,
    failedOperations: 0,
    storageError: null,
  };
  private listeners: Set<(state: SyncState) => void> = new Set();

  constructor() {
    this.queue = new SyncQueue();
    this.idMap = new IdMappingStore();
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(client: ConvexReactClient, userId: Id<'users'>): Promise<void> {
    this.client = client;
    this.userId = userId;
    await this.queue.load();
    await this.idMap.load();
    this.updateState({ status: 'idle', pendingOperations: this.queue.length });
  }

  async reset(): Promise<void> {
    this.client = null;
    this.userId = null;
    await this.queue.clear();
    await this.idMap.clear();
    this.updateState({
      status: 'idle',
      lastSyncAt: null,
      pendingOperations: 0,
      error: null,
    });
  }

  // ============================================
  // State Management
  // ============================================

  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SyncState {
    return { ...this.state };
  }

  // ============================================
  // Queue Operations (Called by Stores)
  // ============================================

  async queueCreate(
    entityType: SyncEntityType,
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.queue.add({
      entityType,
      entityId,
      operation: 'create',
      payload,
    });
    this.updateState({ pendingOperations: this.queue.length });
  }

  async queueUpdate(
    entityType: SyncEntityType,
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.queue.add({
      entityType,
      entityId,
      operation: 'update',
      payload,
    });
    this.updateState({ pendingOperations: this.queue.length });
  }

  async queueDelete(entityType: SyncEntityType, entityId: string): Promise<void> {
    await this.queue.add({
      entityType,
      entityId,
      operation: 'delete',
      payload: {},
    });
    this.updateState({ pendingOperations: this.queue.length });
  }

  // ============================================
  // Sync Operations
  // ============================================

  async sync(): Promise<SyncResult> {
    if (!this.client || !this.userId) {
      return { success: false, pushed: 0, pulled: 0, errors: ['Not initialized'] };
    }

    if (this.state.status === 'syncing') {
      return { success: false, pushed: 0, pulled: 0, errors: ['Sync already in progress'] };
    }

    this.updateState({ status: 'syncing', error: null });
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;

    try {
      // Phase 1: Push local changes to Convex
      const pushResult = await this.pushChanges();
      pushed = pushResult.pushed;
      errors.push(...pushResult.errors);

      // Phase 2: Pull remote changes from Convex
      const pullResult = await this.pullChanges();
      pulled = pullResult.pulled;
      errors.push(...pullResult.errors);

      this.updateState({
        status: errors.length > 0 ? 'error' : 'idle',
        lastSyncAt: Date.now(),
        pendingOperations: this.queue.length,
        error: errors.length > 0 ? errors.join('; ') : null,
      });

      return { success: errors.length === 0, pushed, pulled, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      this.updateState({ status: 'error', error: message });
      return { success: false, pushed, pulled, errors: [message] };
    }
  }

  // ============================================
  // Push (Local -> Convex)
  // ============================================

  private async pushChanges(): Promise<{ pushed: number; errors: string[] }> {
    const items = this.queue.getPending();
    const errors: string[] = [];
    let pushed = 0;

    // Process in order: schemas first, then days, then exercises, etc.
    const orderedItems = this.orderByDependencies(items);

    for (const item of orderedItems) {
      try {
        await this.pushItem(item);
        await this.queue.remove(item.id);
        pushed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Push failed';
        await this.queue.markFailed(item.id, message);
        errors.push(`${item.entityType}:${item.entityId} - ${message}`);
      }
    }

    return { pushed, errors };
  }

  private orderByDependencies(items: SyncQueueItem[]): SyncQueueItem[] {
    const order: SyncEntityType[] = [
      'schema',
      'workoutDay',
      'exercise',
      'workoutSession',
      'exerciseLog',
      'setLog',
    ];

    return [...items].sort((a, b) => {
      const aIndex = order.indexOf(a.entityType);
      const bIndex = order.indexOf(b.entityType);
      if (aIndex !== bIndex) return aIndex - bIndex;
      // For same type, creates before updates before deletes
      const opOrder: SyncOperation[] = ['create', 'update', 'delete'];
      return opOrder.indexOf(a.operation) - opOrder.indexOf(b.operation);
    });
  }

  private async pushItem(item: SyncQueueItem): Promise<void> {
    if (!this.client || !this.userId) throw new Error('Not initialized');

    switch (item.entityType) {
      case 'schema':
        await this.pushSchema(item);
        break;
      case 'workoutDay':
        await this.pushWorkoutDay(item);
        break;
      case 'exercise':
        await this.pushExercise(item);
        break;
      case 'workoutSession':
        await this.pushWorkoutSession(item);
        break;
      case 'exerciseLog':
        await this.pushExerciseLog(item);
        break;
      case 'setLog':
        await this.pushSetLog(item);
        break;
    }
  }

  private async pushSchema(item: SyncQueueItem): Promise<void> {
    if (!this.client || !this.userId) return;

    const convexId = this.idMap.getConvexId(item.entityId);

    if (item.operation === 'create') {
      const payload = item.payload as unknown as Schema;
      const newId = await this.client.mutation(api.schemas.create, {
        userId: this.userId,
        localId: item.entityId,
        name: payload.name,
        progressiveLoadingEnabled: payload.progressiveLoadingEnabled,
      });
      await this.idMap.set(item.entityId, newId, 'schema');
    } else if (item.operation === 'update') {
      if (!convexId) throw new Error('No mapping found for schema');
      await this.client.mutation(api.schemas.update, {
        id: convexId as Id<'schemas'>,
        ...item.payload,
      });
    } else if (item.operation === 'delete') {
      if (convexId) {
        await this.client.mutation(api.schemas.remove, {
          id: convexId as Id<'schemas'>,
        });
        await this.idMap.remove(item.entityId);
      }
    }
  }

  private async pushWorkoutDay(item: SyncQueueItem): Promise<void> {
    if (!this.client) return;

    const convexId = this.idMap.getConvexId(item.entityId);
    const payload = item.payload as unknown as WorkoutDay;

    if (item.operation === 'create') {
      const schemaConvexId = this.idMap.getConvexId(payload.schemaId);
      if (!schemaConvexId) throw new Error('Parent schema not synced');

      const newId = await this.client.mutation(api.workoutDays.create, {
        schemaId: schemaConvexId as Id<'schemas'>,
        localId: item.entityId,
        name: payload.name,
        orderIndex: payload.orderIndex,
      });
      await this.idMap.set(item.entityId, newId, 'workoutDay');
    } else if (item.operation === 'update') {
      if (!convexId) throw new Error('No mapping found for workout day');
      await this.client.mutation(api.workoutDays.update, {
        id: convexId as Id<'workoutDays'>,
        name: payload.name,
        orderIndex: payload.orderIndex,
      });
    } else if (item.operation === 'delete') {
      if (convexId) {
        await this.client.mutation(api.workoutDays.remove, {
          id: convexId as Id<'workoutDays'>,
        });
        await this.idMap.remove(item.entityId);
      }
    }
  }

  private async pushExercise(item: SyncQueueItem): Promise<void> {
    if (!this.client) return;

    const convexId = this.idMap.getConvexId(item.entityId);
    const payload = item.payload as unknown as Exercise;

    if (item.operation === 'create') {
      const dayConvexId = this.idMap.getConvexId(payload.dayId);
      if (!dayConvexId) throw new Error('Parent workout day not synced');

      const newId = await this.client.mutation(api.exercises.create, {
        dayId: dayConvexId as Id<'workoutDays'>,
        localId: item.entityId,
        name: payload.name,
        equipmentType: payload.equipmentType,
        baseWeight: payload.baseWeight,
        targetSets: payload.targetSets,
        targetRepsMin: payload.targetRepsMin,
        targetRepsMax: payload.targetRepsMax,
        progressiveLoadingEnabled: payload.progressiveLoadingEnabled,
        progressionIncrement: payload.progressionIncrement,
        orderIndex: payload.orderIndex,
      });
      await this.idMap.set(item.entityId, newId, 'exercise');
    } else if (item.operation === 'update') {
      if (!convexId) throw new Error('No mapping found for exercise');
      await this.client.mutation(api.exercises.update, {
        id: convexId as Id<'exercises'>,
        ...item.payload,
      });
    } else if (item.operation === 'delete') {
      if (convexId) {
        await this.client.mutation(api.exercises.remove, {
          id: convexId as Id<'exercises'>,
        });
        await this.idMap.remove(item.entityId);
      }
    }
  }

  private async pushWorkoutSession(item: SyncQueueItem): Promise<void> {
    if (!this.client || !this.userId) return;

    const convexId = this.idMap.getConvexId(item.entityId);
    const payload = item.payload as unknown as WorkoutSession;

    if (item.operation === 'create') {
      const schemaConvexId = this.idMap.getConvexId(payload.schemaId);
      const dayConvexId = this.idMap.getConvexId(payload.dayId);
      if (!schemaConvexId || !dayConvexId) throw new Error('Parent entities not synced');

      // Use createDirect for sync - exercise logs and set logs are pushed separately
      const newId = await this.client.mutation(api.workoutSessions.createDirect, {
        userId: this.userId,
        schemaId: schemaConvexId as Id<'schemas'>,
        dayId: dayConvexId as Id<'workoutDays'>,
        localId: item.entityId,
        startedAt: payload.startedAt,
        completedAt: payload.completedAt ?? undefined,
        status: payload.status,
      });
      await this.idMap.set(item.entityId, newId, 'workoutSession');
    } else if (item.operation === 'update') {
      if (!convexId) throw new Error('No mapping found for workout session');
      if (payload.status === 'completed') {
        await this.client.mutation(api.workoutSessions.complete, {
          id: convexId as Id<'workoutSessions'>,
        });
      }
    } else if (item.operation === 'delete') {
      if (convexId) {
        await this.client.mutation(api.workoutSessions.abandon, {
          id: convexId as Id<'workoutSessions'>,
        });
        await this.idMap.remove(item.entityId);
      }
    }
  }

  private async pushExerciseLog(item: SyncQueueItem): Promise<void> {
    if (!this.client) return;

    const convexId = this.idMap.getConvexId(item.entityId);
    const payload = item.payload as unknown as ExerciseLog;

    if (item.operation === 'create') {
      const sessionConvexId = this.idMap.getConvexId(payload.sessionId);
      const exerciseConvexId = this.idMap.getConvexId(payload.exerciseId);
      if (!sessionConvexId || !exerciseConvexId) throw new Error('Parent entities not synced');

      const newId = await this.client.mutation(api.exerciseLogs.createDirect, {
        sessionId: sessionConvexId as Id<'workoutSessions'>,
        exerciseId: exerciseConvexId as Id<'exercises'>,
        localId: item.entityId,
        status: payload.status,
        microplateUsed: payload.microplateUsed,
        totalWeight: payload.totalWeight,
        progressionEarned: payload.progressionEarned,
        updatedAt: payload.updatedAt,
      });
      await this.idMap.set(item.entityId, newId, 'exerciseLog');
    } else if (item.operation === 'update') {
      if (!convexId) throw new Error('No mapping found for exercise log');

      if (payload.status === 'completed') {
        await this.client.mutation(api.exerciseLogs.complete, {
          id: convexId as Id<'exerciseLogs'>,
          progressionEarned: payload.progressionEarned,
        });
      } else if (payload.status === 'skipped') {
        await this.client.mutation(api.exerciseLogs.skip, {
          id: convexId as Id<'exerciseLogs'>,
        });
      }
    }
  }

  private async pushSetLog(item: SyncQueueItem): Promise<void> {
    if (!this.client) return;

    const convexId = this.idMap.getConvexId(item.entityId);
    const payload = item.payload as unknown as SetLog;

    if (item.operation === 'create') {
      const exerciseLogConvexId = this.idMap.getConvexId(payload.exerciseLogId);
      if (!exerciseLogConvexId) throw new Error('Parent exercise log not synced');

      const newId = await this.client.mutation(api.setLogs.createDirect, {
        exerciseLogId: exerciseLogConvexId as Id<'exerciseLogs'>,
        localId: item.entityId,
        setNumber: payload.setNumber,
        targetReps: payload.targetReps,
        completedReps: payload.completedReps ?? undefined,
        updatedAt: payload.updatedAt,
      });
      await this.idMap.set(item.entityId, newId, 'setLog');
    } else if (item.operation === 'update' && convexId) {
      if (payload.completedReps !== null) {
        await this.client.mutation(api.setLogs.logReps, {
          id: convexId as Id<'setLogs'>,
          completedReps: payload.completedReps,
        });
      } else {
        await this.client.mutation(api.setLogs.clearReps, {
          id: convexId as Id<'setLogs'>,
        });
      }
    }
  }

  // ============================================
  // Pull (Convex -> Local)
  // ============================================

  private async pullChanges(): Promise<{ pulled: number; errors: string[] }> {
    if (!this.client || !this.userId) {
      return { pulled: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pulled = 0;

    try {
      // Pull schemas with full conflict resolution
      const schemaResult = await this.pullSchemas();
      pulled += schemaResult.pulled;
      errors.push(...schemaResult.errors);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pull failed';
      errors.push(message);
    }

    return { pulled, errors };
  }

  /**
   * Pull schemas with conflict resolution for schemas, days, and exercises.
   * Uses last-write-wins strategy based on updatedAt timestamps.
   */
  private async pullSchemas(): Promise<{ pulled: number; errors: string[] }> {
    if (!this.client || !this.userId) {
      return { pulled: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pulled = 0;

    try {
      const remoteSchemas = await this.client.query(api.schemas.list, {});

      for (const remote of remoteSchemas) {
        const localId = this.idMap.getLocalId(remote._id);

        if (!localId) {
          // New schema from remote - create locally
          const newLocal = await db.createSchema(remote.name, remote.progressiveLoadingEnabled);
          await this.idMap.set(newLocal.id, remote._id, 'schema');
          pulled++;

          // Pull all days and exercises for this new schema
          const dayResult = await this.pullDaysForSchema(remote._id, newLocal.id);
          pulled += dayResult.pulled;
          errors.push(...dayResult.errors);
        } else {
          // Existing schema - resolve conflict using last-write-wins
          const local = await db.getSchemaById(localId);
          if (local) {
            const conflict = resolveConflict(local.updatedAt, remote.updatedAt);
            if (conflict.winner === 'remote') {
              await db.updateSchema(localId, {
                name: remote.name,
                progressiveLoadingEnabled: remote.progressiveLoadingEnabled,
              });
              pulled++;
            }

            // Always check for day updates regardless of schema conflict winner
            const dayResult = await this.pullDaysForSchema(remote._id, localId);
            pulled += dayResult.pulled;
            errors.push(...dayResult.errors);
          }
        }
      }

      // Check for remotely deleted schemas
      const localSchemas = await db.getSchemas();
      for (const local of localSchemas) {
        const convexId = this.idMap.getConvexId(local.id);
        if (convexId) {
          const stillExists = remoteSchemas.some(
            (r: { _id: string }) => r._id === convexId
          );
          if (!stillExists) {
            // Schema deleted on remote - delete locally
            await db.deleteSchema(local.id);
            await this.idMap.remove(local.id);
            pulled++;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pull schemas failed';
      errors.push(message);
    }

    return { pulled, errors };
  }

  /**
   * Pull workout days for a schema with conflict resolution.
   */
  private async pullDaysForSchema(
    remoteSchemaId: string,
    localSchemaId: string
  ): Promise<{ pulled: number; errors: string[] }> {
    if (!this.client) {
      return { pulled: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pulled = 0;

    try {
      const remoteDays = await this.client.query(api.workoutDays.listBySchema, {
        schemaId: remoteSchemaId as Id<'schemas'>,
      });

      for (const remoteDay of remoteDays) {
        const localDayId = this.idMap.getLocalId(remoteDay._id);

        if (!localDayId) {
          // New day from remote - create locally
          const newDay = await db.createWorkoutDay(
            localSchemaId,
            remoteDay.name,
            remoteDay.orderIndex
          );
          await this.idMap.set(newDay.id, remoteDay._id, 'workoutDay');
          pulled++;

          // Pull exercises for this new day
          const exerciseResult = await this.pullExercisesForDay(remoteDay._id, newDay.id);
          pulled += exerciseResult.pulled;
          errors.push(...exerciseResult.errors);
        } else {
          // Existing day - resolve conflict using last-write-wins
          const localDay = await db.getWorkoutDayById(localDayId);
          if (localDay) {
            const conflict = resolveConflict(localDay.updatedAt, remoteDay.updatedAt);
            if (conflict.winner === 'remote') {
              await db.updateWorkoutDay(localDayId, {
                name: remoteDay.name,
                orderIndex: remoteDay.orderIndex,
              });
              pulled++;
            }

            // Always check for exercise updates
            const exerciseResult = await this.pullExercisesForDay(remoteDay._id, localDayId);
            pulled += exerciseResult.pulled;
            errors.push(...exerciseResult.errors);
          }
        }
      }

      // Check for remotely deleted days
      const localDays = await db.getWorkoutDaysBySchema(localSchemaId);
      for (const localDay of localDays) {
        const convexId = this.idMap.getConvexId(localDay.id);
        if (convexId) {
          const stillExists = remoteDays.some(
            (r: { _id: string }) => r._id === convexId
          );
          if (!stillExists) {
            await db.deleteWorkoutDay(localDay.id);
            await this.idMap.remove(localDay.id);
            pulled++;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pull days failed';
      errors.push(message);
    }

    return { pulled, errors };
  }

  /**
   * Pull exercises for a workout day with conflict resolution.
   */
  private async pullExercisesForDay(
    remoteDayId: string,
    localDayId: string
  ): Promise<{ pulled: number; errors: string[] }> {
    if (!this.client) {
      return { pulled: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pulled = 0;

    try {
      const remoteExercises = await this.client.query(api.exercises.listByDay, {
        dayId: remoteDayId as Id<'workoutDays'>,
      });

      for (const remoteExercise of remoteExercises) {
        const localExerciseId = this.idMap.getLocalId(remoteExercise._id);

        if (!localExerciseId) {
          // New exercise from remote - create locally
          const newExercise = await db.createExercise({
            dayId: localDayId,
            name: remoteExercise.name,
            equipmentType: remoteExercise.equipmentType,
            baseWeight: remoteExercise.baseWeight,
            targetSets: remoteExercise.targetSets,
            targetRepsMin: remoteExercise.targetRepsMin,
            targetRepsMax: remoteExercise.targetRepsMax,
            progressiveLoadingEnabled: remoteExercise.progressiveLoadingEnabled,
            progressionIncrement: remoteExercise.progressionIncrement,
            currentWeight: remoteExercise.currentWeight,
            orderIndex: remoteExercise.orderIndex,
          });
          await this.idMap.set(newExercise.id, remoteExercise._id, 'exercise');
          pulled++;
        } else {
          // Existing exercise - resolve conflict using last-write-wins
          const localExercise = await db.getExerciseById(localExerciseId);
          if (localExercise) {
            const conflict = resolveConflict(localExercise.updatedAt, remoteExercise.updatedAt);
            if (conflict.winner === 'remote') {
              await db.updateExercise(localExerciseId, {
                name: remoteExercise.name,
                equipmentType: remoteExercise.equipmentType,
                baseWeight: remoteExercise.baseWeight,
                targetSets: remoteExercise.targetSets,
                targetRepsMin: remoteExercise.targetRepsMin,
                targetRepsMax: remoteExercise.targetRepsMax,
                progressiveLoadingEnabled: remoteExercise.progressiveLoadingEnabled,
                progressionIncrement: remoteExercise.progressionIncrement,
                currentWeight: remoteExercise.currentWeight,
                orderIndex: remoteExercise.orderIndex,
              });
              pulled++;
            }
          }
        }
      }

      // Check for remotely deleted exercises
      const localExercises = await db.getExercisesByDay(localDayId);
      for (const localExercise of localExercises) {
        const convexId = this.idMap.getConvexId(localExercise.id);
        if (convexId) {
          const stillExists = remoteExercises.some(
            (r: { _id: string }) => r._id === convexId
          );
          if (!stillExists) {
            await db.deleteExercise(localExercise.id);
            await this.idMap.remove(localExercise.id);
            pulled++;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pull exercises failed';
      errors.push(message);
    }

    return { pulled, errors };
  }

  // ============================================
  // Full Sync (Initial Load)
  // ============================================

  async fullSync(): Promise<SyncResult> {
    if (!this.client || !this.userId) {
      return { success: false, pushed: 0, pulled: 0, errors: ['Not initialized'] };
    }

    this.updateState({ status: 'syncing', error: null });

    try {
      // First, push all local data that doesn't have mappings
      const pushResult = await this.pushAllLocalData();

      // Then pull all remote data
      const pullResult = await this.pullChanges();

      const errors = [...pushResult.errors, ...pullResult.errors];

      this.updateState({
        status: errors.length > 0 ? 'error' : 'idle',
        lastSyncAt: Date.now(),
        pendingOperations: this.queue.length,
        error: errors.length > 0 ? errors.join('; ') : null,
      });

      return {
        success: errors.length === 0,
        pushed: pushResult.pushed,
        pulled: pullResult.pulled,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Full sync failed';
      this.updateState({ status: 'error', error: message });
      return { success: false, pushed: 0, pulled: 0, errors: [message] };
    }
  }

  private async pushAllLocalData(): Promise<{ pushed: number; errors: string[] }> {
    if (!this.client || !this.userId) {
      return { pushed: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pushed = 0;

    try {
      // Phase 1: Push all schemas, days, and exercises
      const schemaResult = await this.pushSchemasWithDaysAndExercises();
      pushed += schemaResult.pushed;
      errors.push(...schemaResult.errors);

      // Phase 2: Push all workout sessions with logs
      const sessionResult = await this.pushWorkoutSessionsWithLogs();
      pushed += sessionResult.pushed;
      errors.push(...sessionResult.errors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push all failed';
      errors.push(message);
    }

    return { pushed, errors };
  }

  private async pushSchemasWithDaysAndExercises(): Promise<{ pushed: number; errors: string[] }> {
    if (!this.client || !this.userId) {
      return { pushed: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pushed = 0;

    // Get all local schemas without mappings
    const schemas = await db.getSchemas();

    for (const schema of schemas) {
      if (!this.idMap.has(schema.id)) {
        try {
          // Create schema in Convex
          const convexId = await this.client.mutation(api.schemas.create, {
            userId: this.userId,
            localId: schema.id,
            name: schema.name,
            progressiveLoadingEnabled: schema.progressiveLoadingEnabled,
          });
          await this.idMap.set(schema.id, convexId, 'schema');
          pushed++;

          // Push workout days
          const schemaWithDays = await db.getSchemaWithDays(schema.id);
          if (schemaWithDays) {
            for (const day of schemaWithDays.days) {
              const dayConvexId = await this.client.mutation(api.workoutDays.create, {
                schemaId: convexId as Id<'schemas'>,
                localId: day.id,
                name: day.name,
                orderIndex: day.orderIndex,
              });
              await this.idMap.set(day.id, dayConvexId, 'workoutDay');
              pushed++;

              // Push exercises
              for (const exercise of day.exercises) {
                const exerciseConvexId = await this.client.mutation(api.exercises.create, {
                  dayId: dayConvexId as Id<'workoutDays'>,
                  localId: exercise.id,
                  name: exercise.name,
                  equipmentType: exercise.equipmentType,
                  baseWeight: exercise.baseWeight,
                  targetSets: exercise.targetSets,
                  targetRepsMin: exercise.targetRepsMin,
                  targetRepsMax: exercise.targetRepsMax,
                  progressiveLoadingEnabled: exercise.progressiveLoadingEnabled,
                  progressionIncrement: exercise.progressionIncrement,
                  orderIndex: exercise.orderIndex,
                });
                await this.idMap.set(exercise.id, exerciseConvexId, 'exercise');
                pushed++;
              }
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Push failed';
          errors.push(`Schema ${schema.name}: ${message}`);
        }
      }
    }

    return { pushed, errors };
  }

  private async pushWorkoutSessionsWithLogs(): Promise<{ pushed: number; errors: string[] }> {
    if (!this.client || !this.userId) {
      return { pushed: 0, errors: ['Not initialized'] };
    }

    const errors: string[] = [];
    let pushed = 0;

    // Get all local workout sessions
    const sessions = await db.getWorkoutSessions();

    for (const session of sessions) {
      // Skip if already synced
      if (this.idMap.has(session.id)) {
        continue;
      }

      // Check if parent schema and day have been synced
      const schemaConvexId = this.idMap.getConvexId(session.schemaId);
      const dayConvexId = this.idMap.getConvexId(session.dayId);

      if (!schemaConvexId || !dayConvexId) {
        errors.push(`Session ${session.id}: Parent schema or day not synced`);
        continue;
      }

      try {
        // Create session using createDirect mutation (doesn't auto-create logs)
        const sessionConvexId = await this.client.mutation(api.workoutSessions.createDirect, {
          userId: this.userId,
          schemaId: schemaConvexId as Id<'schemas'>,
          dayId: dayConvexId as Id<'workoutDays'>,
          localId: session.id,
          startedAt: session.startedAt,
          completedAt: session.completedAt ?? undefined,
          status: session.status,
        });
        await this.idMap.set(session.id, sessionConvexId, 'workoutSession');
        pushed++;

        // Push exercise logs for this session
        const exerciseLogs = await db.getExerciseLogsBySession(session.id);

        for (const exerciseLog of exerciseLogs) {
          // Get the Convex ID for the exercise
          const exerciseConvexId = this.idMap.getConvexId(exerciseLog.exerciseId);

          if (!exerciseConvexId) {
            errors.push(`ExerciseLog ${exerciseLog.id}: Parent exercise not synced`);
            continue;
          }

          try {
            // Create exercise log using createDirect mutation
            const exerciseLogConvexId = await this.client.mutation(api.exerciseLogs.createDirect, {
              sessionId: sessionConvexId as Id<'workoutSessions'>,
              exerciseId: exerciseConvexId as Id<'exercises'>,
              localId: exerciseLog.id,
              status: exerciseLog.status,
              microplateUsed: exerciseLog.microplateUsed,
              totalWeight: exerciseLog.totalWeight,
              progressionEarned: exerciseLog.progressionEarned,
              updatedAt: exerciseLog.updatedAt,
            });
            await this.idMap.set(exerciseLog.id, exerciseLogConvexId, 'exerciseLog');
            pushed++;

            // Push set logs for this exercise log
            const setLogs = await db.getSetLogsByExerciseLog(exerciseLog.id);

            for (const setLog of setLogs) {
              try {
                const setLogConvexId = await this.client.mutation(api.setLogs.createDirect, {
                  exerciseLogId: exerciseLogConvexId as Id<'exerciseLogs'>,
                  localId: setLog.id,
                  setNumber: setLog.setNumber,
                  targetReps: setLog.targetReps,
                  completedReps: setLog.completedReps ?? undefined,
                  updatedAt: setLog.updatedAt,
                });
                await this.idMap.set(setLog.id, setLogConvexId, 'setLog');
                pushed++;
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Push failed';
                errors.push(`SetLog ${setLog.id}: ${message}`);
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Push failed';
            errors.push(`ExerciseLog ${exerciseLog.id}: ${message}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Push failed';
        errors.push(`Session ${session.id}: ${message}`);
      }
    }

    return { pushed, errors };
  }

  // ============================================
  // Utility Methods
  // ============================================

  hasPendingChanges(): boolean {
    return this.queue.length > 0;
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getIdMapping(localId: string): string | undefined {
    return this.idMap.getConvexId(localId);
  }

  hasMapping(localId: string): boolean {
    return this.idMap.has(localId);
  }

  // ============================================
  // Subscription Support Methods
  // ============================================

  /**
   * Get local ID from Convex ID (reverse lookup).
   * Used by subscription hooks to find local entities.
   */
  getLocalIdFromConvex(convexId: string): string | undefined {
    return this.idMap.getLocalId(convexId);
  }

  /**
   * Set an ID mapping (exposed for subscription hooks).
   */
  async setIdMapping(localId: string, convexId: string, entityType: SyncEntityType): Promise<void> {
    await this.idMap.set(localId, convexId, entityType);
  }

  /**
   * Remove an ID mapping (exposed for subscription hooks).
   */
  async removeIdMapping(localId: string): Promise<void> {
    await this.idMap.remove(localId);
  }

  /**
   * Check if a Convex ID has a mapping.
   */
  hasConvexIdMapping(convexId: string): boolean {
    return this.idMap.hasConvexId(convexId);
  }
}

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// Singleton Instance
// ============================================

export const syncEngine = new SyncEngine();

// ============================================
// React Hook for Sync State
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function useSyncEngine() {
  const [state, setState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => {
    return syncEngine.subscribe(setState);
  }, []);

  const sync = useCallback(async () => {
    return syncEngine.sync();
  }, []);

  const fullSync = useCallback(async () => {
    return syncEngine.fullSync();
  }, []);

  return {
    ...state,
    sync,
    fullSync,
    hasPendingChanges: syncEngine.hasPendingChanges(),
  };
}
