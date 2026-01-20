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

  // Exercise operations
  addExercise: (dayId: string, exercise: Omit<Exercise, 'id' | 'dayId' | 'orderIndex'>) => Promise<Exercise>;
  updateExercise: (
    id: string,
    updates: Partial<Omit<Exercise, 'id' | 'dayId'>>
  ) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;

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
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workout day',
        isLoading: false,
      });
      throw error;
    }
  },

  // Exercise operations
  addExercise: async (
    dayId: string,
    exercise: Omit<Exercise, 'id' | 'dayId' | 'orderIndex'>
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
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete exercise',
        isLoading: false,
      });
      throw error;
    }
  },

  // Utility
  clearError: () => set({ error: null }),
  clearCurrentSchema: () => set({ currentSchema: null }),
}));
