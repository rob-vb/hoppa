import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/contexts/auth-context';
import { syncEngine } from '@/utils/sync-engine';
import * as db from '@/db/database';
import type { Id } from '@/convex/_generated/dataModel';

/**
 * Hook for real-time Convex subscriptions.
 *
 * Subscribes to Convex data changes and syncs them to local SQLite.
 * Uses Convex's built-in subscription mechanism (useQuery) which automatically
 * receives real-time updates when data changes on the server.
 */
export function useConvexSubscriptions() {
  const { user, isAuthenticated } = useAuth();

  // Track if we've done initial sync to avoid processing during first load
  const hasInitialSyncRef = useRef(false);
  const previousSchemasRef = useRef<string | null>(null);

  // Subscribe to schemas list - this will automatically update when schemas change
  const schemas = useQuery(
    api.schemas.list,
    isAuthenticated && user ? { userId: user._id as Id<'users'> } : 'skip'
  );

  // Subscribe to in-progress workout session
  const inProgressSession = useQuery(
    api.workoutSessions.getInProgress,
    isAuthenticated && user ? { userId: user._id as Id<'users'> } : 'skip'
  );

  // Subscribe to completed sessions (for history)
  const completedSessions = useQuery(
    api.workoutSessions.listCompleted,
    isAuthenticated && user ? { userId: user._id as Id<'users'> } : 'skip'
  );

  // Handle schema changes from Convex subscription
  const handleSchemaChanges = useCallback(async () => {
    if (!schemas || !user) return;

    // Create a fingerprint of current schemas for comparison
    const currentFingerprint = JSON.stringify(
      schemas.map((s: { _id: string; updatedAt: number }) => ({ id: s._id, updatedAt: s.updatedAt }))
    );

    // Skip if this is the initial load or nothing changed
    if (!hasInitialSyncRef.current) {
      previousSchemasRef.current = currentFingerprint;
      hasInitialSyncRef.current = true;
      return;
    }

    if (currentFingerprint === previousSchemasRef.current) {
      return;
    }

    previousSchemasRef.current = currentFingerprint;

    // Process changes - sync remote schemas to local
    for (const remoteSchema of schemas) {
      const localId = syncEngine.getLocalIdFromConvex(remoteSchema._id);

      if (!localId) {
        // New schema from remote - create locally
        try {
          const newLocal = await db.createSchema(
            remoteSchema.name,
            remoteSchema.progressiveLoadingEnabled
          );
          await syncEngine.setIdMapping(newLocal.id, remoteSchema._id, 'schema');

          // Fetch and sync days/exercises for this new schema
          await syncSchemaDetails(remoteSchema._id, newLocal.id);
        } catch (error) {
          console.error('Failed to create local schema from subscription:', error);
        }
      } else {
        // Existing schema - check if remote is newer
        try {
          const localSchema = await db.getSchemaById(localId);
          if (localSchema && remoteSchema.updatedAt > localSchema.updatedAt) {
            await db.updateSchema(localId, {
              name: remoteSchema.name,
              progressiveLoadingEnabled: remoteSchema.progressiveLoadingEnabled,
            });
          }
        } catch (error) {
          console.error('Failed to update local schema from subscription:', error);
        }
      }
    }

    // Check for deleted schemas
    try {
      const localSchemas = await db.getSchemas();
      for (const localSchema of localSchemas) {
        const convexId = syncEngine.getIdMapping(localSchema.id);
        if (convexId) {
          const stillExists = schemas.some((s: { _id: string }) => s._id === convexId);
          if (!stillExists) {
            await db.deleteSchema(localSchema.id);
            await syncEngine.removeIdMapping(localSchema.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for deleted schemas:', error);
    }
  }, [schemas, user]);

  // Sync schema details (days and exercises) for a newly discovered remote schema
  const syncSchemaDetails = async (convexSchemaId: string, localSchemaId: string) => {
    // This would require additional queries - for now we'll let the regular sync handle it
    // The initial sync will pull all the details
  };

  // Effect to process schema changes
  useEffect(() => {
    handleSchemaChanges();
  }, [handleSchemaChanges]);

  // Effect to track in-progress session changes
  useEffect(() => {
    if (!inProgressSession || !user) return;

    // If there's an in-progress session on remote that we don't have locally,
    // the regular sync will handle pulling it down
    // This subscription mainly helps with multi-device scenarios
  }, [inProgressSession, user]);

  return {
    schemas,
    inProgressSession,
    completedSessions,
    isLoading: schemas === undefined,
  };
}

/**
 * Hook for subscribing to a specific schema with all its details (days, exercises).
 * Use this when viewing or editing a specific schema.
 */
export function useSchemaSubscription(schemaId: string | null) {
  const { isAuthenticated } = useAuth();

  // Get the Convex ID for this local schema ID
  const convexId = schemaId ? syncEngine.getIdMapping(schemaId) : null;

  // Subscribe to schema with full details
  const schemaWithDays = useQuery(
    api.schemas.getWithDays,
    isAuthenticated && convexId ? { id: convexId as Id<'schemas'> } : 'skip'
  );

  // Track previous state to detect changes
  const previousDataRef = useRef<string | null>(null);

  useEffect(() => {
    if (!schemaWithDays || !schemaId) return;

    const currentFingerprint = JSON.stringify({
      id: schemaWithDays._id,
      updatedAt: schemaWithDays.updatedAt,
      days: schemaWithDays.days.map((d: { _id: string; exercises: Array<{ _id: string; currentWeight: number }> }) => ({
        id: d._id,
        exercises: d.exercises.map((e: { _id: string; currentWeight: number }) => ({
          id: e._id,
          currentWeight: e.currentWeight,
        })),
      })),
    });

    if (currentFingerprint === previousDataRef.current) return;
    previousDataRef.current = currentFingerprint;

    // Sync changes to local database
    syncSchemaWithDaysToLocal(schemaWithDays, schemaId);
  }, [schemaWithDays, schemaId]);

  return {
    schemaWithDays,
    isLoading: convexId ? schemaWithDays === undefined : false,
  };
}

// Helper to sync a schema with days/exercises to local database
async function syncSchemaWithDaysToLocal(
  remote: NonNullable<Awaited<ReturnType<typeof api.schemas.getWithDays._returnType>>>,
  localSchemaId: string
) {
  if (!remote) return;

  try {
    // Update schema
    const localSchema = await db.getSchemaById(localSchemaId);
    if (localSchema && remote.updatedAt > localSchema.updatedAt) {
      await db.updateSchema(localSchemaId, {
        name: remote.name,
        progressiveLoadingEnabled: remote.progressiveLoadingEnabled,
      });
    }

    // Sync days
    for (const remoteDay of remote.days) {
      const localDayId = syncEngine.getLocalIdFromConvex(remoteDay._id);

      if (!localDayId) {
        // New day - create locally
        const newDay = await db.createWorkoutDay(
          localSchemaId,
          remoteDay.name,
          remoteDay.orderIndex
        );
        await syncEngine.setIdMapping(newDay.id, remoteDay._id, 'workoutDay');

        // Sync exercises for this day
        for (const remoteExercise of remoteDay.exercises) {
          const newExercise = await db.createExercise({
            dayId: newDay.id,
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
          await syncEngine.setIdMapping(newExercise.id, remoteExercise._id, 'exercise');
        }
      } else {
        // Existing day - update and sync exercises
        await db.updateWorkoutDay(localDayId, {
          name: remoteDay.name,
          orderIndex: remoteDay.orderIndex,
        });

        // Sync exercises
        for (const remoteExercise of remoteDay.exercises) {
          const localExerciseId = syncEngine.getLocalIdFromConvex(remoteExercise._id);

          if (!localExerciseId) {
            // New exercise
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
            await syncEngine.setIdMapping(newExercise.id, remoteExercise._id, 'exercise');
          } else {
            // Update existing exercise
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
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to sync schema details to local:', error);
  }
}

/**
 * Hook for subscribing to a workout session with all its logs.
 * Use this during an active workout to get real-time updates.
 */
export function useSessionSubscription(sessionId: string | null) {
  const { isAuthenticated } = useAuth();

  // Get the Convex ID for this local session ID
  const convexId = sessionId ? syncEngine.getIdMapping(sessionId) : null;

  // Subscribe to session with logs
  const sessionWithLogs = useQuery(
    api.workoutSessions.getWithLogs,
    isAuthenticated && convexId ? { id: convexId as Id<'workoutSessions'> } : 'skip'
  );

  return {
    sessionWithLogs,
    isLoading: convexId ? sessionWithLogs === undefined : false,
  };
}
