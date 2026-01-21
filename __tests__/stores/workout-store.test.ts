import { act } from 'react';
import { useWorkoutStore, ExerciseLogWithDetails, WorkoutSummaryData } from '@/stores/workout-store';
import * as db from '@/db/database';
import {
  Schema,
  Exercise,
  WorkoutSession,
  ExerciseLog,
  SetLog,
  WorkoutDayWithExercises,
} from '@/db/types';

// Mock the database module
jest.mock('@/db/database');

// Mock the progression engine
jest.mock('@/utils/progression-engine', () => ({
  isProgressionEnabled: jest.fn((schema, exercise) =>
    schema.progressiveLoadingEnabled && exercise.progressiveLoadingEnabled
  ),
}));

const mockedDb = db as jest.Mocked<typeof db>;

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
  updatedAt: Date.now(),
  ...overrides,
});

const createWorkoutDay = (overrides: Partial<WorkoutDayWithExercises> = {}): WorkoutDayWithExercises => ({
  id: 'day-1',
  schemaId: 'schema-1',
  name: 'Day A',
  orderIndex: 0,
  updatedAt: Date.now(),
  exercises: [createExercise()],
  ...overrides,
});

const createSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session-1',
  schemaId: 'schema-1',
  dayId: 'day-1',
  startedAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
  completedAt: null,
  status: 'in_progress',
  ...overrides,
});

const createExerciseLog = (overrides: Partial<ExerciseLog> = {}): ExerciseLog => ({
  id: 'log-1',
  sessionId: 'session-1',
  exerciseId: 'exercise-1',
  status: 'pending',
  microplateUsed: 0,
  totalWeight: 60,
  progressionEarned: false,
  updatedAt: Date.now(),
  ...overrides,
});

const createSetLog = (setNumber: number, completedReps: number | null = null): SetLog => ({
  id: `set-${setNumber}`,
  exerciseLogId: 'log-1',
  setNumber,
  targetReps: '5-7',
  completedReps,
  updatedAt: Date.now(),
});

const createExerciseLogWithDetails = (
  overrides: Partial<ExerciseLogWithDetails> = {}
): ExerciseLogWithDetails => ({
  ...createExerciseLog(),
  sets: [createSetLog(1), createSetLog(2), createSetLog(3)],
  exercise: createExercise(),
  ...overrides,
});

describe('workout-store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkoutStore.setState({
      session: null,
      exerciseLogs: [],
      currentExerciseIndex: 0,
      isLoading: false,
      error: null,
    });
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('startWorkout', () => {
    it('should create a new workout session', async () => {
      const day = createWorkoutDay();
      const session = createSession();
      const exerciseLog = createExerciseLog();
      const setLog = createSetLog(1);

      mockedDb.createWorkoutSession.mockResolvedValue(session);
      mockedDb.createExerciseLog.mockResolvedValue(exerciseLog);
      mockedDb.createSetLog.mockResolvedValue(setLog);

      await act(async () => {
        await useWorkoutStore.getState().startWorkout(day, 'schema-1');
      });

      expect(useWorkoutStore.getState().session).toEqual(session);
      expect(useWorkoutStore.getState().exerciseLogs).toHaveLength(1);
      expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      expect(mockedDb.createWorkoutSession).toHaveBeenCalledWith('schema-1', 'day-1');
    });

    it('should create exercise logs for each exercise', async () => {
      const exercises = [
        createExercise({ id: 'ex-1' }),
        createExercise({ id: 'ex-2' }),
      ];
      const day = createWorkoutDay({ exercises });
      const session = createSession();

      mockedDb.createWorkoutSession.mockResolvedValue(session);
      mockedDb.createExerciseLog.mockImplementation(async (sessionId, exerciseId) =>
        createExerciseLog({ id: `log-${exerciseId}`, exerciseId })
      );
      mockedDb.createSetLog.mockImplementation(async (logId, setNumber) =>
        createSetLog(setNumber)
      );

      await act(async () => {
        await useWorkoutStore.getState().startWorkout(day, 'schema-1');
      });

      expect(useWorkoutStore.getState().exerciseLogs).toHaveLength(2);
      expect(mockedDb.createExerciseLog).toHaveBeenCalledTimes(2);
    });

    it('should create set logs for each set', async () => {
      const exercise = createExercise({ targetSets: 4 });
      const day = createWorkoutDay({ exercises: [exercise] });
      const session = createSession();

      mockedDb.createWorkoutSession.mockResolvedValue(session);
      mockedDb.createExerciseLog.mockResolvedValue(createExerciseLog());
      mockedDb.createSetLog.mockImplementation(async (logId, setNumber) =>
        createSetLog(setNumber)
      );

      await act(async () => {
        await useWorkoutStore.getState().startWorkout(day, 'schema-1');
      });

      expect(mockedDb.createSetLog).toHaveBeenCalledTimes(4);
    });

    it('should handle errors', async () => {
      const day = createWorkoutDay();
      mockedDb.createWorkoutSession.mockRejectedValue(new Error('Database error'));

      await expect(
        act(async () => {
          await useWorkoutStore.getState().startWorkout(day, 'schema-1');
        })
      ).rejects.toThrow();

      expect(useWorkoutStore.getState().error).toBe('Database error');
    });
  });

  describe('resumeWorkout', () => {
    it('should return false when no active session exists', async () => {
      mockedDb.getActiveWorkoutSession.mockResolvedValue(null);

      let result: boolean = false;
      await act(async () => {
        result = await useWorkoutStore.getState().resumeWorkout();
      });

      expect(result).toBe(false);
      expect(useWorkoutStore.getState().session).toBe(null);
    });

    it('should resume active session and load exercise logs', async () => {
      const session = createSession();
      const exerciseLog = createExerciseLog();
      const exercise = createExercise();
      const sets = [createSetLog(1), createSetLog(2)];

      mockedDb.getActiveWorkoutSession.mockResolvedValue(session);
      mockedDb.getExerciseLogsBySession.mockResolvedValue([exerciseLog]);
      mockedDb.getExerciseById.mockResolvedValue(exercise);
      mockedDb.getSetLogsByExerciseLog.mockResolvedValue(sets);

      let result: boolean = false;
      await act(async () => {
        result = await useWorkoutStore.getState().resumeWorkout();
      });

      expect(result).toBe(true);
      expect(useWorkoutStore.getState().session).toEqual(session);
      expect(useWorkoutStore.getState().exerciseLogs).toHaveLength(1);
    });

    it('should set currentExerciseIndex to first pending exercise', async () => {
      const session = createSession();
      const log1 = createExerciseLog({ id: 'log-1', status: 'completed' });
      const log2 = createExerciseLog({ id: 'log-2', status: 'pending' });
      const exercise = createExercise();

      mockedDb.getActiveWorkoutSession.mockResolvedValue(session);
      mockedDb.getExerciseLogsBySession.mockResolvedValue([log1, log2]);
      mockedDb.getExerciseById.mockResolvedValue(exercise);
      mockedDb.getSetLogsByExerciseLog.mockResolvedValue([]);

      await act(async () => {
        await useWorkoutStore.getState().resumeWorkout();
      });

      expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    });
  });

  describe('completeWorkout', () => {
    it('should return null when no session exists', async () => {
      let result: WorkoutSummaryData | null = null;
      await act(async () => {
        result = await useWorkoutStore.getState().completeWorkout();
      });

      expect(result).toBe(null);
    });

    it('should complete session and clear state', async () => {
      const session = createSession();
      const exerciseLog = createExerciseLogWithDetails({ status: 'completed' });
      useWorkoutStore.setState({
        session,
        exerciseLogs: [exerciseLog],
      });

      mockedDb.completeWorkoutSession.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().completeWorkout();
      });

      expect(useWorkoutStore.getState().session).toBe(null);
      expect(useWorkoutStore.getState().exerciseLogs).toEqual([]);
      expect(mockedDb.completeWorkoutSession).toHaveBeenCalledWith('session-1');
    });

    it('should apply progressions for earned exercises', async () => {
      const session = createSession();
      const exerciseLog = createExerciseLogWithDetails({
        status: 'completed',
        progressionEarned: true,
        exercise: createExercise({ currentWeight: 60, progressionIncrement: 2.5 }),
      });
      useWorkoutStore.setState({
        session,
        exerciseLogs: [exerciseLog],
      });

      mockedDb.updateExercise.mockResolvedValue(undefined);
      mockedDb.completeWorkoutSession.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().completeWorkout();
      });

      expect(mockedDb.updateExercise).toHaveBeenCalledWith('exercise-1', {
        currentWeight: 62.5,
      });
    });

    it('should return workout summary', async () => {
      const session = createSession({ startedAt: Date.now() - 60000 }); // 1 minute ago
      const exerciseLog = createExerciseLogWithDetails({
        status: 'completed',
        sets: [
          createSetLog(1, 7),
          createSetLog(2, 6),
        ],
      });
      useWorkoutStore.setState({
        session,
        exerciseLogs: [exerciseLog],
      });

      mockedDb.completeWorkoutSession.mockResolvedValue(undefined);

      let result: WorkoutSummaryData | null = null;
      await act(async () => {
        result = await useWorkoutStore.getState().completeWorkout();
      });

      expect(result).not.toBe(null);
      expect(result!.completedExercises).toBe(1);
      expect(result!.totalSetsCompleted).toBe(2);
      expect(result!.totalReps).toBe(13);
    });
  });

  describe('cancelWorkout', () => {
    it('should do nothing when no session exists', async () => {
      await act(async () => {
        await useWorkoutStore.getState().cancelWorkout();
      });

      expect(mockedDb.deleteWorkoutSession).not.toHaveBeenCalled();
    });

    it('should delete session and clear state', async () => {
      const session = createSession();
      useWorkoutStore.setState({ session });
      mockedDb.deleteWorkoutSession.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().cancelWorkout();
      });

      expect(useWorkoutStore.getState().session).toBe(null);
      expect(mockedDb.deleteWorkoutSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('exercise navigation', () => {
    beforeEach(() => {
      const logs = [
        createExerciseLogWithDetails({ id: 'log-1' }),
        createExerciseLogWithDetails({ id: 'log-2' }),
        createExerciseLogWithDetails({ id: 'log-3' }),
      ];
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: logs,
        currentExerciseIndex: 0,
      });
    });

    describe('setCurrentExercise', () => {
      it('should set valid index', () => {
        act(() => {
          useWorkoutStore.getState().setCurrentExercise(1);
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });

      it('should not set negative index', () => {
        act(() => {
          useWorkoutStore.getState().setCurrentExercise(-1);
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });

      it('should not set index beyond array length', () => {
        act(() => {
          useWorkoutStore.getState().setCurrentExercise(5);
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });
    });

    describe('nextExercise', () => {
      it('should increment index', () => {
        act(() => {
          useWorkoutStore.getState().nextExercise();
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });

      it('should not exceed array bounds', () => {
        useWorkoutStore.setState({ currentExerciseIndex: 2 });
        act(() => {
          useWorkoutStore.getState().nextExercise();
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(2);
      });
    });

    describe('previousExercise', () => {
      it('should decrement index', () => {
        useWorkoutStore.setState({ currentExerciseIndex: 2 });
        act(() => {
          useWorkoutStore.getState().previousExercise();
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });

      it('should not go below 0', () => {
        act(() => {
          useWorkoutStore.getState().previousExercise();
        });
        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });
    });
  });

  describe('logReps', () => {
    it('should update set log in database and state', async () => {
      const log = createExerciseLogWithDetails({
        sets: [createSetLog(1), createSetLog(2)],
      });
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [log],
      });
      mockedDb.updateSetLog.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().logReps('set-1', 7);
      });

      const set = useWorkoutStore.getState().exerciseLogs[0].sets[0];
      expect(set.completedReps).toBe(7);
      expect(mockedDb.updateSetLog).toHaveBeenCalledWith('set-1', 7);
    });
  });

  describe('clearReps', () => {
    it('should clear set log in database and state', async () => {
      const log = createExerciseLogWithDetails({
        sets: [createSetLog(1, 7), createSetLog(2, 6)],
      });
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [log],
      });
      mockedDb.updateSetLog.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().clearReps('set-1');
      });

      const set = useWorkoutStore.getState().exerciseLogs[0].sets[0];
      expect(set.completedReps).toBe(null);
      expect(mockedDb.updateSetLog).toHaveBeenCalledWith('set-1', null);
    });
  });

  describe('completeExercise', () => {
    it('should mark exercise as completed', async () => {
      const log = createExerciseLogWithDetails({ id: 'log-1' });
      const session = createSession();
      useWorkoutStore.setState({
        session,
        exerciseLogs: [log],
      });

      mockedDb.getSchemaById.mockResolvedValue(createSchema({ progressiveLoadingEnabled: false }));
      mockedDb.updateExerciseLog.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().completeExercise('log-1');
      });

      expect(useWorkoutStore.getState().exerciseLogs[0].status).toBe('completed');
      expect(mockedDb.updateExerciseLog).toHaveBeenCalledWith('log-1', {
        status: 'completed',
        progressionEarned: false,
      });
    });
  });

  describe('skipExercise', () => {
    it('should mark exercise as skipped', async () => {
      const log = createExerciseLogWithDetails({ id: 'log-1' });
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [log],
      });
      mockedDb.updateExerciseLog.mockResolvedValue(undefined);

      await act(async () => {
        await useWorkoutStore.getState().skipExercise('log-1');
      });

      expect(useWorkoutStore.getState().exerciseLogs[0].status).toBe('skipped');
    });
  });

  describe('checkAndApplyProgression', () => {
    it('should return false when no session', async () => {
      const log = createExerciseLogWithDetails();
      useWorkoutStore.setState({ exerciseLogs: [log] });

      let result = false;
      await act(async () => {
        result = await useWorkoutStore.getState().checkAndApplyProgression('log-1');
      });

      expect(result).toBe(false);
    });

    it('should return false when exercise log not found', async () => {
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [],
      });

      let result = false;
      await act(async () => {
        result = await useWorkoutStore.getState().checkAndApplyProgression('nonexistent');
      });

      expect(result).toBe(false);
    });

    it('should return true when all conditions met', async () => {
      const log = createExerciseLogWithDetails({
        sets: [createSetLog(1, 7), createSetLog(2, 7), createSetLog(3, 7)],
        exercise: createExercise({ progressiveLoadingEnabled: true, targetRepsMax: 7 }),
      });
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [log],
      });
      mockedDb.getSchemaById.mockResolvedValue(createSchema({ progressiveLoadingEnabled: true }));

      let result = false;
      await act(async () => {
        result = await useWorkoutStore.getState().checkAndApplyProgression('log-1');
      });

      expect(result).toBe(true);
    });

    it('should return false when not all sets completed', async () => {
      const log = createExerciseLogWithDetails({
        sets: [createSetLog(1, 7), createSetLog(2, null), createSetLog(3, 7)],
      });
      useWorkoutStore.setState({
        session: createSession(),
        exerciseLogs: [log],
      });
      mockedDb.getSchemaById.mockResolvedValue(createSchema({ progressiveLoadingEnabled: true }));

      let result = false;
      await act(async () => {
        result = await useWorkoutStore.getState().checkAndApplyProgression('log-1');
      });

      expect(result).toBe(false);
    });
  });

  describe('getCurrentExerciseLog', () => {
    it('should return current exercise log', () => {
      const log = createExerciseLogWithDetails({ id: 'log-1' });
      useWorkoutStore.setState({
        exerciseLogs: [log],
        currentExerciseIndex: 0,
      });

      const current = useWorkoutStore.getState().getCurrentExerciseLog();
      expect(current?.id).toBe('log-1');
    });

    it('should return null when no logs', () => {
      const current = useWorkoutStore.getState().getCurrentExerciseLog();
      expect(current).toBe(null);
    });
  });

  describe('isExerciseComplete', () => {
    it('should return true for completed exercises', () => {
      const log = createExerciseLogWithDetails({ id: 'log-1', status: 'completed' });
      useWorkoutStore.setState({ exerciseLogs: [log] });

      expect(useWorkoutStore.getState().isExerciseComplete('log-1')).toBe(true);
    });

    it('should return true for skipped exercises', () => {
      const log = createExerciseLogWithDetails({ id: 'log-1', status: 'skipped' });
      useWorkoutStore.setState({ exerciseLogs: [log] });

      expect(useWorkoutStore.getState().isExerciseComplete('log-1')).toBe(true);
    });

    it('should return false for pending exercises', () => {
      const log = createExerciseLogWithDetails({ id: 'log-1', status: 'pending' });
      useWorkoutStore.setState({ exerciseLogs: [log] });

      expect(useWorkoutStore.getState().isExerciseComplete('log-1')).toBe(false);
    });
  });

  describe('getCompletedSetsCount', () => {
    it('should count completed sets', () => {
      const log = createExerciseLogWithDetails({
        id: 'log-1',
        sets: [createSetLog(1, 7), createSetLog(2, null), createSetLog(3, 6)],
      });
      useWorkoutStore.setState({ exerciseLogs: [log] });

      expect(useWorkoutStore.getState().getCompletedSetsCount('log-1')).toBe(2);
    });

    it('should return 0 when log not found', () => {
      expect(useWorkoutStore.getState().getCompletedSetsCount('nonexistent')).toBe(0);
    });
  });

  describe('getWorkoutSummary', () => {
    it('should return null when no session', () => {
      expect(useWorkoutStore.getState().getWorkoutSummary()).toBe(null);
    });

    it('should calculate correct summary', () => {
      const session = createSession({ startedAt: Date.now() - 60000 });
      const logs = [
        createExerciseLogWithDetails({
          id: 'log-1',
          status: 'completed',
          progressionEarned: true,
          sets: [createSetLog(1, 7), createSetLog(2, 7)],
          exercise: createExercise({ name: 'Bench Press', currentWeight: 60, progressionIncrement: 2.5 }),
        }),
        createExerciseLogWithDetails({
          id: 'log-2',
          status: 'skipped',
          sets: [],
        }),
        createExerciseLogWithDetails({
          id: 'log-3',
          status: 'pending',
          sets: [createSetLog(1, 5)],
        }),
      ];
      useWorkoutStore.setState({ session, exerciseLogs: logs });

      const summary = useWorkoutStore.getState().getWorkoutSummary();

      expect(summary?.completedExercises).toBe(1);
      expect(summary?.skippedExercises).toBe(1);
      expect(summary?.totalExercises).toBe(3);
      expect(summary?.progressionsEarned).toHaveLength(1);
      expect(summary?.progressionsEarned[0].exerciseName).toBe('Bench Press');
      expect(summary?.progressionsEarned[0].oldWeight).toBe(60);
      expect(summary?.progressionsEarned[0].newWeight).toBe(62.5);
      expect(summary?.totalSetsCompleted).toBe(3); // 2 + 0 + 1
      expect(summary?.totalReps).toBe(19); // 7 + 7 + 5
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useWorkoutStore.setState({ error: 'Some error' });

      act(() => {
        useWorkoutStore.getState().clearError();
      });

      expect(useWorkoutStore.getState().error).toBe(null);
    });
  });
});
