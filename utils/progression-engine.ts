import { Schema, Exercise, SetLog } from '@/db/types';

/**
 * Result of a progression check
 */
export interface ProgressionResult {
  /** Whether progression was earned */
  earned: boolean;
  /** Reason why progression was or wasn't earned */
  reason: ProgressionReason;
  /** Current weight before any progression */
  currentWeight: number;
  /** New weight after progression (same as current if not earned) */
  newWeight: number;
  /** The increment that was/would be applied */
  increment: number;
}

export type ProgressionReason =
  | 'schema_disabled'
  | 'exercise_disabled'
  | 'exercise_skipped'
  | 'incomplete_sets'
  | 'below_target_reps'
  | 'progression_earned';

/**
 * Human-readable messages for progression reasons
 */
export const PROGRESSION_MESSAGES: Record<ProgressionReason, string> = {
  schema_disabled: 'Progressive loading is disabled for this schema',
  exercise_disabled: 'Progressive loading is disabled for this exercise',
  exercise_skipped: 'Exercise was skipped',
  incomplete_sets: 'Not all sets were completed',
  below_target_reps: 'Not all sets hit the target reps',
  progression_earned: 'Progression earned!',
};

/**
 * Check if progressive loading is enabled at the schema level
 */
export function isSchemaProgressionEnabled(schema: Schema): boolean {
  return schema.progressiveLoadingEnabled;
}

/**
 * Check if progressive loading is enabled for a specific exercise
 * Note: This only checks the exercise-level toggle. You should also check
 * the schema-level toggle with isSchemaProgressionEnabled()
 */
export function isExerciseProgressionEnabled(exercise: Exercise): boolean {
  return exercise.progressiveLoadingEnabled;
}

/**
 * Check if progression is enabled for an exercise considering both
 * schema-level and exercise-level toggles
 */
export function isProgressionEnabled(schema: Schema, exercise: Exercise): boolean {
  return schema.progressiveLoadingEnabled && exercise.progressiveLoadingEnabled;
}

/**
 * Check if all sets have been completed (have a completedReps value)
 */
export function areAllSetsCompleted(sets: SetLog[]): boolean {
  if (sets.length === 0) return false;
  return sets.every((set) => set.completedReps !== null);
}

/**
 * Check if all sets hit the maximum target reps
 * For a target of "5-7 reps", the user must hit 7 reps on every set to progress
 */
export function allSetsHitTargetMax(sets: SetLog[], targetRepsMax: number): boolean {
  if (sets.length === 0) return false;
  return sets.every(
    (set) => set.completedReps !== null && set.completedReps >= targetRepsMax
  );
}

/**
 * Core progression check function
 *
 * Checks if a progression should be earned based on:
 * 1. Schema-level progressive loading toggle
 * 2. Exercise-level progressive loading toggle
 * 3. Exercise completion status (not skipped)
 * 4. All sets completed with reps logged
 * 5. All sets hitting the maximum target reps
 *
 * @param schema - The workout schema
 * @param exercise - The exercise being checked
 * @param sets - The set logs for this exercise
 * @param exerciseStatus - The status of the exercise ('pending' | 'completed' | 'skipped')
 * @returns ProgressionResult with earned status and reason
 */
export function checkProgression(
  schema: Schema,
  exercise: Exercise,
  sets: SetLog[],
  exerciseStatus: 'pending' | 'completed' | 'skipped'
): ProgressionResult {
  const baseResult = {
    currentWeight: exercise.currentWeight,
    newWeight: exercise.currentWeight,
    increment: exercise.progressionIncrement,
  };

  // Check schema-level progressive loading toggle
  if (!schema.progressiveLoadingEnabled) {
    return {
      ...baseResult,
      earned: false,
      reason: 'schema_disabled',
    };
  }

  // Check exercise-level progressive loading toggle
  if (!exercise.progressiveLoadingEnabled) {
    return {
      ...baseResult,
      earned: false,
      reason: 'exercise_disabled',
    };
  }

  // Check if exercise was skipped
  if (exerciseStatus === 'skipped') {
    return {
      ...baseResult,
      earned: false,
      reason: 'exercise_skipped',
    };
  }

  // Check if all sets are completed
  if (!areAllSetsCompleted(sets)) {
    return {
      ...baseResult,
      earned: false,
      reason: 'incomplete_sets',
    };
  }

  // Check if all sets hit the maximum target reps
  if (!allSetsHitTargetMax(sets, exercise.targetRepsMax)) {
    return {
      ...baseResult,
      earned: false,
      reason: 'below_target_reps',
    };
  }

  // Progression earned!
  const newWeight = exercise.currentWeight + exercise.progressionIncrement;
  return {
    earned: true,
    reason: 'progression_earned',
    currentWeight: exercise.currentWeight,
    newWeight,
    increment: exercise.progressionIncrement,
  };
}

/**
 * Calculate the new weight after a progression
 */
export function calculateNewWeight(
  currentWeight: number,
  progressionIncrement: number
): number {
  return currentWeight + progressionIncrement;
}

/**
 * Get a user-friendly message describing the progression result
 */
export function getProgressionMessage(result: ProgressionResult): string {
  if (result.earned) {
    return `${PROGRESSION_MESSAGES[result.reason]} +${result.increment}kg next session`;
  }
  return PROGRESSION_MESSAGES[result.reason];
}

/**
 * Simplified check that just returns a boolean
 * Use checkProgression() when you need the full result with reason
 */
export function isProgressionEarned(
  schema: Schema,
  exercise: Exercise,
  sets: SetLog[],
  exerciseStatus: 'pending' | 'completed' | 'skipped'
): boolean {
  return checkProgression(schema, exercise, sets, exerciseStatus).earned;
}
