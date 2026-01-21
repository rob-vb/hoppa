import { create } from 'zustand';
import {
  Schema,
  SchemaWithDays,
  WorkoutDay,
  WorkoutDayWithExercises,
  Exercise,
  EquipmentType,
} from '@/db/types';
import * as db from '@/db/database';
import { syncEngine } from '@/utils/sync-engine';

interface SchemaState {
  schemas: Schema[];
  currentSchema: SchemaWithDays | null;
  isLoading: boolean;
  error: string | null;
}

interface SchemaActions {
  // Schema operations
  loadSchemas: () => Promise<void>;
  loadSchemaWithDays: (schemaId: string) => Promise<void>;
  createSchema: (name: string, progressiveLoadingEnabled?: boolean) => Promise<Schema>;
  updateSchema: (
    id: string,
    updates: Partial<Pick<Schema, 'name' | 'progressiveLoadingEnabled'>>
  ) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;

  // Workout Day operations
  addWorkoutDay: (schemaId: string, name: string) => Promise<WorkoutDay>;
  updateWorkoutDay: (
    id: string,
    updates: Partial<Pick<WorkoutDay, 'name' | 'orderIndex'>>
  ) => Promise<void>;
  deleteWorkoutDay: (id: string) => Promise<void>;
  reorderWorkoutDays: (dayIds: string[]) => Promise<void>;

  // Exercise operations
  addExercise: (dayId: string, exercise: Omit<Exercise, 'id' | 'dayId' | 'orderIndex' | 'updatedAt'>) => Promise<Exercise>;
  updateExercise: (
    id: string,
    updates: Partial<Omit<Exercise, 'id' | 'dayId'>>
  ) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  reorderExercises: (dayId: string, exerciseIds: string[]) => Promise<void>;

  // Utility
  clearError: () => void;
  clearCurrentSchema: () => void;
}

type SchemaStore = SchemaState & SchemaActions;

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemas: [],
  currentSchema: null,
  isLoading: false,
  error: null,

  // Schema operations
  loadSchemas: async () => {
    set({ isLoading: true, error: null });
    try {
      const schemas = await db.getSchemas();
      set({ schemas, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load schemas',
        isLoading: false,
      });
    }
  },

  loadSchemaWithDays: async (schemaId: string) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await db.getSchemaWithDays(schemaId);
      set({ currentSchema: schema, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load schema',
        isLoading: false,
      });
    }
  },

  createSchema: async (name: string, progressiveLoadingEnabled: boolean = true) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await db.createSchema(name, progressiveLoadingEnabled);
      set((state) => ({
        schemas: [schema, ...state.schemas],
        isLoading: false,
      }));

      // Queue for sync
      await syncEngine.queueCreate('schema', schema.id, {
        name: schema.name,
        progressiveLoadingEnabled: schema.progressiveLoadingEnabled,
      });

      return schema;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create schema',
        isLoading: false,
      });
      throw error;
    }
  },

  updateSchema: async (
    id: string,
    updates: Partial<Pick<Schema, 'name' | 'progressiveLoadingEnabled'>>
  ) => {
    set({ isLoading: true, error: null });
    try {
      await db.updateSchema(id, updates);

      // Update local state
      set((state) => ({
        schemas: state.schemas.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
        ),
        currentSchema:
          state.currentSchema?.id === id
            ? { ...state.currentSchema, ...updates, updatedAt: Date.now() }
            : state.currentSchema,
        isLoading: false,
      }));

      // Queue for sync
      await syncEngine.queueUpdate('schema', id, updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update schema',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteSchema: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await db.deleteSchema(id);

      set((state) => ({
        schemas: state.schemas.filter((s) => s.id !== id),
        currentSchema: state.currentSchema?.id === id ? null : state.currentSchema,
        isLoading: false,
      }));

      // Queue for sync
      await syncEngine.queueDelete('schema', id);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete schema',
        isLoading: false,
      });
      throw error;
    }
  },

  // Workout Day operations
  addWorkoutDay: async (schemaId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      // Let the database calculate the orderIndex to avoid race conditions
      const day = await db.createWorkoutDay(schemaId, name);

      // Update currentSchema if it's the one being modified
      set((state) => {
        if (state.currentSchema?.id === schemaId) {
          const dayWithExercises: WorkoutDayWithExercises = { ...day, exercises: [] };
          return {
            currentSchema: {
              ...state.currentSchema,
              days: [...state.currentSchema.days, dayWithExercises],
              updatedAt: Date.now(),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueCreate('workoutDay', day.id, {
        schemaId: day.schemaId,
        name: day.name,
        orderIndex: day.orderIndex,
      });

      return day;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add workout day',
        isLoading: false,
      });
      throw error;
    }
  },

  updateWorkoutDay: async (
    id: string,
    updates: Partial<Pick<WorkoutDay, 'name' | 'orderIndex'>>
  ) => {
    set({ isLoading: true, error: null });
    try {
      await db.updateWorkoutDay(id, updates);

      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.map((d) =>
                d.id === id ? { ...d, ...updates } : d
              ),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueUpdate('workoutDay', id, updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update workout day',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteWorkoutDay: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await db.deleteWorkoutDay(id);

      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.filter((d) => d.id !== id),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueDelete('workoutDay', id);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workout day',
        isLoading: false,
      });
      throw error;
    }
  },

  reorderWorkoutDays: async (dayIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      // Update each day's orderIndex in the database
      for (let i = 0; i < dayIds.length; i++) {
        await db.updateWorkoutDay(dayIds[i], { orderIndex: i });
        await syncEngine.queueUpdate('workoutDay', dayIds[i], { orderIndex: i });
      }

      // Reorder days in local state
      set((state) => {
        if (state.currentSchema) {
          const dayMap = new Map(state.currentSchema.days.map((d) => [d.id, d]));
          const reorderedDays = dayIds
            .map((id, index) => {
              const day = dayMap.get(id);
              return day ? { ...day, orderIndex: index } : null;
            })
            .filter((d): d is WorkoutDayWithExercises => d !== null);

          return {
            currentSchema: {
              ...state.currentSchema,
              days: reorderedDays,
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reorder workout days',
        isLoading: false,
      });
      throw error;
    }
  },

  // Exercise operations
  addExercise: async (
    dayId: string,
    exercise: Omit<Exercise, 'id' | 'dayId' | 'orderIndex' | 'updatedAt'>
  ) => {
    set({ isLoading: true, error: null });
    try {
      // Let the database calculate the orderIndex to avoid race conditions
      const newExercise = await db.createExercise({
        ...exercise,
        dayId,
      });

      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.map((d) =>
                d.id === dayId
                  ? { ...d, exercises: [...d.exercises, newExercise] }
                  : d
              ),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueCreate('exercise', newExercise.id, {
        dayId: newExercise.dayId,
        name: newExercise.name,
        notes: newExercise.notes,
        equipmentType: newExercise.equipmentType,
        baseWeight: newExercise.baseWeight,
        targetSets: newExercise.targetSets,
        targetRepsMin: newExercise.targetRepsMin,
        targetRepsMax: newExercise.targetRepsMax,
        progressiveLoadingEnabled: newExercise.progressiveLoadingEnabled,
        progressionIncrement: newExercise.progressionIncrement,
        currentWeight: newExercise.currentWeight,
        orderIndex: newExercise.orderIndex,
      });

      return newExercise;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add exercise',
        isLoading: false,
      });
      throw error;
    }
  },

  updateExercise: async (
    id: string,
    updates: Partial<Omit<Exercise, 'id' | 'dayId'>>
  ) => {
    set({ isLoading: true, error: null });
    try {
      await db.updateExercise(id, updates);

      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.map((d) => ({
                ...d,
                exercises: d.exercises.map((e) =>
                  e.id === id ? { ...e, ...updates } : e
                ),
              })),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueUpdate('exercise', id, updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update exercise',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteExercise: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await db.deleteExercise(id);

      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.map((d) => ({
                ...d,
                exercises: d.exercises.filter((e) => e.id !== id),
              })),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });

      // Queue for sync
      await syncEngine.queueDelete('exercise', id);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete exercise',
        isLoading: false,
      });
      throw error;
    }
  },

  reorderExercises: async (dayId: string, exerciseIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      // Update each exercise's orderIndex in the database
      for (let i = 0; i < exerciseIds.length; i++) {
        await db.updateExercise(exerciseIds[i], { orderIndex: i });
        await syncEngine.queueUpdate('exercise', exerciseIds[i], { orderIndex: i });
      }

      // Reorder exercises in local state
      set((state) => {
        if (state.currentSchema) {
          return {
            currentSchema: {
              ...state.currentSchema,
              days: state.currentSchema.days.map((d) => {
                if (d.id !== dayId) return d;

                const exerciseMap = new Map(d.exercises.map((e) => [e.id, e]));
                const reorderedExercises = exerciseIds
                  .map((id, index) => {
                    const exercise = exerciseMap.get(id);
                    return exercise ? { ...exercise, orderIndex: index } : null;
                  })
                  .filter((e): e is Exercise => e !== null);

                return { ...d, exercises: reorderedExercises };
              }),
            },
            isLoading: false,
          };
        }
        return { isLoading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reorder exercises',
        isLoading: false,
      });
      throw error;
    }
  },

  // Utility
  clearError: () => set({ error: null }),
  clearCurrentSchema: () => set({ currentSchema: null }),
}));
