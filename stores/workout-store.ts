import { create } from 'zustand';
import {
  WorkoutSession,
  Exercise,
  ExerciseLog,
  SetLog,
  ExerciseLogWithSets,
  WorkoutDayWithExercises,
} from '@/db/types';
import * as db from '@/db/database';

interface ActiveExerciseLog extends ExerciseLogWithSets {
  exercise: Exercise;
}

interface WorkoutState {
  // Active session
  session: WorkoutSession | null;
  exerciseLogs: ActiveExerciseLog[];
  currentExerciseIndex: number;

  // Loading/error states
  isLoading: boolean;
  error: string | null;
}

export interface WorkoutSummaryData {
  duration: number;
  completedExercises: number;
  skippedExercises: number;
  totalExercises: number;
  progressionsEarned: Array<{
    exerciseName: string;
    oldWeight: number;
    newWeight: number;
  }>;
  totalSetsCompleted: number;
  totalReps: number;
}

interface WorkoutActions {
  // Session management
  startWorkout: (day: WorkoutDayWithExercises, schemaId: string) => Promise<void>;
  resumeWorkout: () => Promise<boolean>;
  completeWorkout: () => Promise<WorkoutSummaryData | null>;
  cancelWorkout: () => Promise<void>;

  // Exercise navigation
  setCurrentExercise: (index: number) => void;
  nextExercise: () => void;
  previousExercise: () => void;

  // Rep logging
  logReps: (setLogId: string, reps: number) => Promise<void>;
  clearReps: (setLogId: string) => Promise<void>;

  // Exercise completion
  completeExercise: (exerciseLogId: string) => Promise<void>;
  skipExercise: (exerciseLogId: string) => Promise<void>;

  // Progression
  checkAndApplyProgression: (exerciseLogId: string) => Promise<boolean>;

  // Utility
  clearError: () => void;
  getCurrentExerciseLog: () => ActiveExerciseLog | null;
  isExerciseComplete: (exerciseLogId: string) => boolean;
  getCompletedSetsCount: (exerciseLogId: string) => number;
  getWorkoutSummary: () => WorkoutSummaryData | null;
}

type WorkoutStore = WorkoutState & WorkoutActions;

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  session: null,
  exerciseLogs: [],
  currentExerciseIndex: 0,
  isLoading: false,
  error: null,

  // Session management
  startWorkout: async (day: WorkoutDayWithExercises, schemaId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Create workout session
      const session = await db.createWorkoutSession(schemaId, day.id);

      // Create exercise logs for each exercise
      const exerciseLogs: ActiveExerciseLog[] = [];
      for (const exercise of day.exercises) {
        const totalWeight = exercise.currentWeight;
        const exerciseLog = await db.createExerciseLog(
          session.id,
          exercise.id,
          totalWeight
        );

        // Create set logs for each set
        const sets: SetLog[] = [];
        const targetReps = `${exercise.targetRepsMin}-${exercise.targetRepsMax}`;
        for (let i = 1; i <= exercise.targetSets; i++) {
          const setLog = await db.createSetLog(exerciseLog.id, i, targetReps);
          sets.push(setLog);
        }

        exerciseLogs.push({
          ...exerciseLog,
          sets,
          exercise,
        });
      }

      set({
        session,
        exerciseLogs,
        currentExerciseIndex: 0,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start workout',
        isLoading: false,
      });
      throw error;
    }
  },

  resumeWorkout: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check for active session
      const activeSession = await db.getActiveWorkoutSession();
      if (!activeSession) {
        set({ isLoading: false });
        return false;
      }

      // Load exercise logs
      const logs = await db.getExerciseLogsBySession(activeSession.id);
      const exerciseLogs: ActiveExerciseLog[] = [];

      for (const log of logs) {
        const exercise = await db.getExerciseById(log.exerciseId);
        if (!exercise) continue;

        const sets = await db.getSetLogsByExerciseLog(log.id);
        exerciseLogs.push({
          ...log,
          sets,
          exercise,
        });
      }

      // Find first non-completed exercise
      let currentIndex = exerciseLogs.findIndex(
        (log) => log.status === 'pending'
      );
      if (currentIndex === -1) currentIndex = 0;

      set({
        session: activeSession,
        exerciseLogs,
        currentExerciseIndex: currentIndex,
        isLoading: false,
      });

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to resume workout',
        isLoading: false,
      });
      return false;
    }
  },

  completeWorkout: async () => {
    const { session, exerciseLogs, getWorkoutSummary } = get();
    if (!session) return null;

    set({ isLoading: true, error: null });
    try {
      // Generate summary before clearing state
      const summary = getWorkoutSummary();

      // Apply progressions for completed exercises
      for (const log of exerciseLogs) {
        if (log.status === 'completed' && log.progressionEarned) {
          const newWeight =
            log.exercise.currentWeight + log.exercise.progressionIncrement;
          await db.updateExercise(log.exercise.id, { currentWeight: newWeight });
        }
      }

      // Complete the session
      await db.completeWorkoutSession(session.id);

      set({
        session: null,
        exerciseLogs: [],
        currentExerciseIndex: 0,
        isLoading: false,
      });

      return summary;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete workout',
        isLoading: false,
      });
      throw error;
    }
  },

  cancelWorkout: async () => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });
    try {
      await db.deleteWorkoutSession(session.id);

      set({
        session: null,
        exerciseLogs: [],
        currentExerciseIndex: 0,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel workout',
        isLoading: false,
      });
      throw error;
    }
  },

  // Exercise navigation
  setCurrentExercise: (index: number) => {
    const { exerciseLogs } = get();
    if (index >= 0 && index < exerciseLogs.length) {
      set({ currentExerciseIndex: index });
    }
  },

  nextExercise: () => {
    const { currentExerciseIndex, exerciseLogs } = get();
    if (currentExerciseIndex < exerciseLogs.length - 1) {
      set({ currentExerciseIndex: currentExerciseIndex + 1 });
    }
  },

  previousExercise: () => {
    const { currentExerciseIndex } = get();
    if (currentExerciseIndex > 0) {
      set({ currentExerciseIndex: currentExerciseIndex - 1 });
    }
  },

  // Rep logging
  logReps: async (setLogId: string, reps: number) => {
    set({ error: null });
    try {
      await db.updateSetLog(setLogId, reps);

      // Update local state
      set((state) => ({
        exerciseLogs: state.exerciseLogs.map((log) => ({
          ...log,
          sets: log.sets.map((s) =>
            s.id === setLogId ? { ...s, completedReps: reps } : s
          ),
        })),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to log reps',
      });
      throw error;
    }
  },

  clearReps: async (setLogId: string) => {
    set({ error: null });
    try {
      await db.updateSetLog(setLogId, null);

      // Update local state
      set((state) => ({
        exerciseLogs: state.exerciseLogs.map((log) => ({
          ...log,
          sets: log.sets.map((s) =>
            s.id === setLogId ? { ...s, completedReps: null } : s
          ),
        })),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to clear reps',
      });
      throw error;
    }
  },

  // Exercise completion
  completeExercise: async (exerciseLogId: string) => {
    const { exerciseLogs, checkAndApplyProgression } = get();
    set({ error: null });

    try {
      // Check if progression is earned
      const progressionEarned = await checkAndApplyProgression(exerciseLogId);

      await db.updateExerciseLog(exerciseLogId, {
        status: 'completed',
        progressionEarned,
      });

      // Update local state
      set({
        exerciseLogs: exerciseLogs.map((log) =>
          log.id === exerciseLogId
            ? { ...log, status: 'completed', progressionEarned }
            : log
        ),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete exercise',
      });
      throw error;
    }
  },

  skipExercise: async (exerciseLogId: string) => {
    const { exerciseLogs } = get();
    set({ error: null });

    try {
      await db.updateExerciseLog(exerciseLogId, { status: 'skipped' });

      // Update local state
      set({
        exerciseLogs: exerciseLogs.map((log) =>
          log.id === exerciseLogId ? { ...log, status: 'skipped' } : log
        ),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to skip exercise',
      });
      throw error;
    }
  },

  // Progression logic
  checkAndApplyProgression: async (exerciseLogId: string) => {
    const { exerciseLogs } = get();
    const log = exerciseLogs.find((l) => l.id === exerciseLogId);
    if (!log) return false;

    const { exercise, sets } = log;

    // Progressive loading must be enabled
    if (!exercise.progressiveLoadingEnabled) return false;

    // All sets must be completed
    const completedSets = sets.filter((s) => s.completedReps !== null);
    if (completedSets.length !== sets.length) return false;

    // Check if all sets hit target reps max
    const allSetsHitMax = sets.every((s) => {
      if (s.completedReps === null) return false;
      return s.completedReps >= exercise.targetRepsMax;
    });

    return allSetsHitMax;
  },

  // Utility
  clearError: () => set({ error: null }),

  getCurrentExerciseLog: () => {
    const { exerciseLogs, currentExerciseIndex } = get();
    return exerciseLogs[currentExerciseIndex] || null;
  },

  isExerciseComplete: (exerciseLogId: string) => {
    const { exerciseLogs } = get();
    const log = exerciseLogs.find((l) => l.id === exerciseLogId);
    return log?.status === 'completed' || log?.status === 'skipped';
  },

  getCompletedSetsCount: (exerciseLogId: string) => {
    const { exerciseLogs } = get();
    const log = exerciseLogs.find((l) => l.id === exerciseLogId);
    if (!log) return 0;
    return log.sets.filter((s) => s.completedReps !== null).length;
  },

  getWorkoutSummary: () => {
    const { session, exerciseLogs } = get();
    if (!session) return null;

    const duration = Math.floor((Date.now() - session.startedAt) / 1000);
    const completedExercises = exerciseLogs.filter(
      (log) => log.status === 'completed'
    ).length;
    const skippedExercises = exerciseLogs.filter(
      (log) => log.status === 'skipped'
    ).length;
    const totalExercises = exerciseLogs.length;

    const progressionsEarned = exerciseLogs
      .filter((log) => log.status === 'completed' && log.progressionEarned)
      .map((log) => ({
        exerciseName: log.exercise.name,
        oldWeight: log.exercise.currentWeight,
        newWeight: log.exercise.currentWeight + log.exercise.progressionIncrement,
      }));

    let totalSetsCompleted = 0;
    let totalReps = 0;

    for (const log of exerciseLogs) {
      for (const set of log.sets) {
        if (set.completedReps !== null) {
          totalSetsCompleted++;
          totalReps += set.completedReps;
        }
      }
    }

    return {
      duration,
      completedExercises,
      skippedExercises,
      totalExercises,
      progressionsEarned,
      totalSetsCompleted,
      totalReps,
    };
  },
}));
