import {
  isSchemaProgressionEnabled,
  isExerciseProgressionEnabled,
  isProgressionEnabled,
  areAllSetsCompleted,
  allSetsHitTargetMax,
  checkProgression,
  calculateNewWeight,
  getProgressionMessage,
  isProgressionEarned,
  PROGRESSION_MESSAGES,
  ProgressionResult,
} from '@/utils/progression-engine';
import { Schema, Exercise, SetLog } from '@/db/types';

// Helper to create test data
const createSchema = (overrides: Partial<Schema> = {}): Schema => ({
  id: 'schema-1',
  name: 'Test Schema',
  progressiveLoadingEnabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise-1',
  dayId: 'day-1',
  name: 'Bench Press',
  equipmentType: 'plates',
  baseWeight: 20,
  targetSets: 3,
  targetRepsMin: 5,
  targetRepsMax: 7,
  progressiveLoadingEnabled: true,
  progressionIncrement: 2.5,
  currentWeight: 60,
  orderIndex: 0,
  ...overrides,
});

const createSetLog = (
  setNumber: number,
  completedReps: number | null,
  overrides: Partial<SetLog> = {}
): SetLog => ({
  id: `set-${setNumber}`,
  exerciseLogId: 'exercise-log-1',
  setNumber,
  targetReps: '5-7',
  completedReps,
  ...overrides,
});

const createCompletedSets = (reps: number[]): SetLog[] =>
  reps.map((r, i) => createSetLog(i + 1, r));

describe('progression-engine', () => {
  describe('isSchemaProgressionEnabled', () => {
    it('should return true when progression is enabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: true });
      expect(isSchemaProgressionEnabled(schema)).toBe(true);
    });

    it('should return false when progression is disabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: false });
      expect(isSchemaProgressionEnabled(schema)).toBe(false);
    });
  });

  describe('isExerciseProgressionEnabled', () => {
    it('should return true when exercise progression is enabled', () => {
      const exercise = createExercise({ progressiveLoadingEnabled: true });
      expect(isExerciseProgressionEnabled(exercise)).toBe(true);
    });

    it('should return false when exercise progression is disabled', () => {
      const exercise = createExercise({ progressiveLoadingEnabled: false });
      expect(isExerciseProgressionEnabled(exercise)).toBe(false);
    });
  });

  describe('isProgressionEnabled', () => {
    it('should return true only when both schema and exercise have progression enabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: true });
      const exercise = createExercise({ progressiveLoadingEnabled: true });
      expect(isProgressionEnabled(schema, exercise)).toBe(true);
    });

    it('should return false when schema progression is disabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: false });
      const exercise = createExercise({ progressiveLoadingEnabled: true });
      expect(isProgressionEnabled(schema, exercise)).toBe(false);
    });

    it('should return false when exercise progression is disabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: true });
      const exercise = createExercise({ progressiveLoadingEnabled: false });
      expect(isProgressionEnabled(schema, exercise)).toBe(false);
    });

    it('should return false when both are disabled', () => {
      const schema = createSchema({ progressiveLoadingEnabled: false });
      const exercise = createExercise({ progressiveLoadingEnabled: false });
      expect(isProgressionEnabled(schema, exercise)).toBe(false);
    });
  });

  describe('areAllSetsCompleted', () => {
    it('should return false for empty sets array', () => {
      expect(areAllSetsCompleted([])).toBe(false);
    });

    it('should return true when all sets have completedReps', () => {
      const sets = createCompletedSets([7, 7, 6]);
      expect(areAllSetsCompleted(sets)).toBe(true);
    });

    it('should return false when any set has null completedReps', () => {
      const sets = [
        createSetLog(1, 7),
        createSetLog(2, null),
        createSetLog(3, 7),
      ];
      expect(areAllSetsCompleted(sets)).toBe(false);
    });

    it('should return true even with zero reps completed', () => {
      const sets = createCompletedSets([0, 0, 0]);
      expect(areAllSetsCompleted(sets)).toBe(true);
    });
  });

  describe('allSetsHitTargetMax', () => {
    it('should return false for empty sets array', () => {
      expect(allSetsHitTargetMax([], 7)).toBe(false);
    });

    it('should return true when all sets hit target max', () => {
      const sets = createCompletedSets([7, 7, 7]);
      expect(allSetsHitTargetMax(sets, 7)).toBe(true);
    });

    it('should return true when all sets exceed target max', () => {
      const sets = createCompletedSets([8, 9, 10]);
      expect(allSetsHitTargetMax(sets, 7)).toBe(true);
    });

    it('should return false when any set is below target max', () => {
      const sets = createCompletedSets([7, 6, 7]);
      expect(allSetsHitTargetMax(sets, 7)).toBe(false);
    });

    it('should return false when any set has null completedReps', () => {
      const sets = [
        createSetLog(1, 7),
        createSetLog(2, null),
        createSetLog(3, 7),
      ];
      expect(allSetsHitTargetMax(sets, 7)).toBe(false);
    });

    it('should handle edge case of target 0', () => {
      const sets = createCompletedSets([0, 0, 0]);
      expect(allSetsHitTargetMax(sets, 0)).toBe(true);
    });
  });

  describe('checkProgression', () => {
    describe('progression earned', () => {
      it('should return earned when all conditions are met', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({
          progressiveLoadingEnabled: true,
          currentWeight: 60,
          progressionIncrement: 2.5,
          targetRepsMax: 7,
        });
        const sets = createCompletedSets([7, 7, 7]);

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(true);
        expect(result.reason).toBe('progression_earned');
        expect(result.currentWeight).toBe(60);
        expect(result.newWeight).toBe(62.5);
        expect(result.increment).toBe(2.5);
      });

      it('should earn progression when exceeding target reps', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({
          progressiveLoadingEnabled: true,
          targetRepsMax: 7,
        });
        const sets = createCompletedSets([10, 8, 9]);

        const result = checkProgression(schema, exercise, sets, 'completed');
        expect(result.earned).toBe(true);
      });
    });

    describe('schema disabled', () => {
      it('should not earn when schema progression is disabled', () => {
        const schema = createSchema({ progressiveLoadingEnabled: false });
        const exercise = createExercise({ progressiveLoadingEnabled: true });
        const sets = createCompletedSets([7, 7, 7]);

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('schema_disabled');
        expect(result.newWeight).toBe(result.currentWeight);
      });
    });

    describe('exercise disabled', () => {
      it('should not earn when exercise progression is disabled', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({ progressiveLoadingEnabled: false });
        const sets = createCompletedSets([7, 7, 7]);

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('exercise_disabled');
      });
    });

    describe('exercise skipped', () => {
      it('should not earn when exercise is skipped', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({ progressiveLoadingEnabled: true });
        const sets = createCompletedSets([7, 7, 7]);

        const result = checkProgression(schema, exercise, sets, 'skipped');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('exercise_skipped');
      });
    });

    describe('incomplete sets', () => {
      it('should not earn when not all sets are completed', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({ progressiveLoadingEnabled: true });
        const sets = [
          createSetLog(1, 7),
          createSetLog(2, null),
          createSetLog(3, 7),
        ];

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('incomplete_sets');
      });

      it('should not earn when sets array is empty', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({ progressiveLoadingEnabled: true });

        const result = checkProgression(schema, exercise, [], 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('incomplete_sets');
      });
    });

    describe('below target reps', () => {
      it('should not earn when any set is below target max', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({
          progressiveLoadingEnabled: true,
          targetRepsMax: 7,
        });
        const sets = createCompletedSets([7, 6, 7]);

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('below_target_reps');
      });

      it('should not earn when hitting target min but not max', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({
          progressiveLoadingEnabled: true,
          targetRepsMin: 5,
          targetRepsMax: 7,
        });
        const sets = createCompletedSets([5, 5, 5]);

        const result = checkProgression(schema, exercise, sets, 'completed');

        expect(result.earned).toBe(false);
        expect(result.reason).toBe('below_target_reps');
      });
    });

    describe('pending status', () => {
      it('should check progression even with pending status', () => {
        const schema = createSchema({ progressiveLoadingEnabled: true });
        const exercise = createExercise({ progressiveLoadingEnabled: true });
        const sets = createCompletedSets([7, 7, 7]);

        const result = checkProgression(schema, exercise, sets, 'pending');

        expect(result.earned).toBe(true);
        expect(result.reason).toBe('progression_earned');
      });
    });

    describe('check order priority', () => {
      it('should check schema first, then exercise, then skipped, then sets', () => {
        // When both schema and exercise disabled, should return schema_disabled
        const schema = createSchema({ progressiveLoadingEnabled: false });
        const exercise = createExercise({ progressiveLoadingEnabled: false });
        const sets: SetLog[] = [];

        const result = checkProgression(schema, exercise, sets, 'skipped');
        expect(result.reason).toBe('schema_disabled');
      });
    });
  });

  describe('calculateNewWeight', () => {
    it('should add increment to current weight', () => {
      expect(calculateNewWeight(60, 2.5)).toBe(62.5);
      expect(calculateNewWeight(100, 5)).toBe(105);
    });

    it('should handle zero increment', () => {
      expect(calculateNewWeight(60, 0)).toBe(60);
    });

    it('should handle decimal values', () => {
      expect(calculateNewWeight(57.5, 1.25)).toBe(58.75);
    });
  });

  describe('getProgressionMessage', () => {
    it('should return earned message with increment', () => {
      const result: ProgressionResult = {
        earned: true,
        reason: 'progression_earned',
        currentWeight: 60,
        newWeight: 62.5,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(
        'Progression earned! +2.5kg next session'
      );
    });

    it('should return schema disabled message', () => {
      const result: ProgressionResult = {
        earned: false,
        reason: 'schema_disabled',
        currentWeight: 60,
        newWeight: 60,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(PROGRESSION_MESSAGES.schema_disabled);
    });

    it('should return exercise disabled message', () => {
      const result: ProgressionResult = {
        earned: false,
        reason: 'exercise_disabled',
        currentWeight: 60,
        newWeight: 60,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(PROGRESSION_MESSAGES.exercise_disabled);
    });

    it('should return skipped message', () => {
      const result: ProgressionResult = {
        earned: false,
        reason: 'exercise_skipped',
        currentWeight: 60,
        newWeight: 60,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(PROGRESSION_MESSAGES.exercise_skipped);
    });

    it('should return incomplete sets message', () => {
      const result: ProgressionResult = {
        earned: false,
        reason: 'incomplete_sets',
        currentWeight: 60,
        newWeight: 60,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(PROGRESSION_MESSAGES.incomplete_sets);
    });

    it('should return below target message', () => {
      const result: ProgressionResult = {
        earned: false,
        reason: 'below_target_reps',
        currentWeight: 60,
        newWeight: 60,
        increment: 2.5,
      };

      expect(getProgressionMessage(result)).toBe(PROGRESSION_MESSAGES.below_target_reps);
    });
  });

  describe('isProgressionEarned', () => {
    it('should return true when progression is earned', () => {
      const schema = createSchema({ progressiveLoadingEnabled: true });
      const exercise = createExercise({
        progressiveLoadingEnabled: true,
        targetRepsMax: 7,
      });
      const sets = createCompletedSets([7, 7, 7]);

      expect(isProgressionEarned(schema, exercise, sets, 'completed')).toBe(true);
    });

    it('should return false when progression is not earned', () => {
      const schema = createSchema({ progressiveLoadingEnabled: false });
      const exercise = createExercise({ progressiveLoadingEnabled: true });
      const sets = createCompletedSets([7, 7, 7]);

      expect(isProgressionEarned(schema, exercise, sets, 'completed')).toBe(false);
    });
  });

  describe('PROGRESSION_MESSAGES', () => {
    it('should have messages for all reason types', () => {
      expect(PROGRESSION_MESSAGES.schema_disabled).toBeDefined();
      expect(PROGRESSION_MESSAGES.exercise_disabled).toBeDefined();
      expect(PROGRESSION_MESSAGES.exercise_skipped).toBeDefined();
      expect(PROGRESSION_MESSAGES.incomplete_sets).toBeDefined();
      expect(PROGRESSION_MESSAGES.below_target_reps).toBeDefined();
      expect(PROGRESSION_MESSAGES.progression_earned).toBeDefined();
    });

    it('should have non-empty messages', () => {
      Object.values(PROGRESSION_MESSAGES).forEach((message) => {
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
