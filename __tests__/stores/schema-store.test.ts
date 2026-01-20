import { act } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import * as db from '@/db/database';
import { Schema, SchemaWithDays, WorkoutDay, Exercise } from '@/db/types';

// Mock the database module
jest.mock('@/db/database');

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

const createWorkoutDay = (overrides: Partial<WorkoutDay> = {}): WorkoutDay => ({
  id: 'day-1',
  schemaId: 'schema-1',
  name: 'Day A',
  orderIndex: 0,
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

const createSchemaWithDays = (overrides: Partial<SchemaWithDays> = {}): SchemaWithDays => ({
  ...createSchema(),
  days: [
    {
      ...createWorkoutDay(),
      exercises: [createExercise()],
    },
  ],
  ...overrides,
});

describe('schema-store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSchemaStore.setState({
      schemas: [],
      currentSchema: null,
      isLoading: false,
      error: null,
    });
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('loadSchemas', () => {
    it('should load schemas from database', async () => {
      const mockSchemas = [createSchema({ id: '1' }), createSchema({ id: '2' })];
      mockedDb.getSchemas.mockResolvedValue(mockSchemas);

      await act(async () => {
        await useSchemaStore.getState().loadSchemas();
      });

      expect(useSchemaStore.getState().schemas).toEqual(mockSchemas);
      expect(useSchemaStore.getState().isLoading).toBe(false);
      expect(useSchemaStore.getState().error).toBe(null);
    });

    it('should set loading state while fetching', async () => {
      let loadingDuringFetch = false;
      mockedDb.getSchemas.mockImplementation(async () => {
        loadingDuringFetch = useSchemaStore.getState().isLoading;
        return [];
      });

      await act(async () => {
        await useSchemaStore.getState().loadSchemas();
      });

      expect(loadingDuringFetch).toBe(true);
    });

    it('should handle errors', async () => {
      mockedDb.getSchemas.mockRejectedValue(new Error('Database error'));

      await act(async () => {
        await useSchemaStore.getState().loadSchemas();
      });

      expect(useSchemaStore.getState().error).toBe('Database error');
      expect(useSchemaStore.getState().isLoading).toBe(false);
    });
  });

  describe('loadSchemaWithDays', () => {
    it('should load schema with days from database', async () => {
      const mockSchema = createSchemaWithDays();
      mockedDb.getSchemaWithDays.mockResolvedValue(mockSchema);

      await act(async () => {
        await useSchemaStore.getState().loadSchemaWithDays('schema-1');
      });

      expect(useSchemaStore.getState().currentSchema).toEqual(mockSchema);
      expect(mockedDb.getSchemaWithDays).toHaveBeenCalledWith('schema-1');
    });

    it('should handle errors', async () => {
      mockedDb.getSchemaWithDays.mockRejectedValue(new Error('Not found'));

      await act(async () => {
        await useSchemaStore.getState().loadSchemaWithDays('invalid-id');
      });

      expect(useSchemaStore.getState().error).toBe('Not found');
    });
  });

  describe('createSchema', () => {
    it('should create schema and add to state', async () => {
      const newSchema = createSchema({ id: 'new-1', name: 'New Schema' });
      mockedDb.createSchema.mockResolvedValue(newSchema);

      let result: Schema | undefined;
      await act(async () => {
        result = await useSchemaStore.getState().createSchema('New Schema', true);
      });

      expect(result).toEqual(newSchema);
      expect(useSchemaStore.getState().schemas).toContainEqual(newSchema);
      expect(mockedDb.createSchema).toHaveBeenCalledWith('New Schema', true);
    });

    it('should prepend new schema to list', async () => {
      const existingSchema = createSchema({ id: 'existing' });
      useSchemaStore.setState({ schemas: [existingSchema] });

      const newSchema = createSchema({ id: 'new-1' });
      mockedDb.createSchema.mockResolvedValue(newSchema);

      await act(async () => {
        await useSchemaStore.getState().createSchema('New', true);
      });

      const schemas = useSchemaStore.getState().schemas;
      expect(schemas[0]).toEqual(newSchema);
      expect(schemas[1]).toEqual(existingSchema);
    });

    it('should throw and set error on failure', async () => {
      mockedDb.createSchema.mockRejectedValue(new Error('Create failed'));

      await expect(
        act(async () => {
          await useSchemaStore.getState().createSchema('New', true);
        })
      ).rejects.toThrow('Create failed');

      expect(useSchemaStore.getState().error).toBe('Create failed');
    });
  });

  describe('updateSchema', () => {
    it('should update schema in state', async () => {
      const schema = createSchema({ id: 'schema-1', name: 'Original' });
      useSchemaStore.setState({ schemas: [schema] });
      mockedDb.updateSchema.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().updateSchema('schema-1', { name: 'Updated' });
      });

      const updated = useSchemaStore.getState().schemas.find((s) => s.id === 'schema-1');
      expect(updated?.name).toBe('Updated');
      expect(mockedDb.updateSchema).toHaveBeenCalledWith('schema-1', { name: 'Updated' });
    });

    it('should update currentSchema if it matches', async () => {
      const schema = createSchemaWithDays({ id: 'schema-1', name: 'Original' });
      useSchemaStore.setState({
        schemas: [schema],
        currentSchema: schema,
      });
      mockedDb.updateSchema.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().updateSchema('schema-1', { name: 'Updated' });
      });

      expect(useSchemaStore.getState().currentSchema?.name).toBe('Updated');
    });
  });

  describe('deleteSchema', () => {
    it('should delete schema from state', async () => {
      const schema = createSchema({ id: 'schema-1' });
      useSchemaStore.setState({ schemas: [schema] });
      mockedDb.deleteSchema.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().deleteSchema('schema-1');
      });

      expect(useSchemaStore.getState().schemas).toHaveLength(0);
      expect(mockedDb.deleteSchema).toHaveBeenCalledWith('schema-1');
    });

    it('should clear currentSchema if it matches deleted schema', async () => {
      const schema = createSchemaWithDays({ id: 'schema-1' });
      useSchemaStore.setState({
        schemas: [schema],
        currentSchema: schema,
      });
      mockedDb.deleteSchema.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().deleteSchema('schema-1');
      });

      expect(useSchemaStore.getState().currentSchema).toBe(null);
    });
  });

  describe('addWorkoutDay', () => {
    it('should add workout day to currentSchema', async () => {
      const schema = createSchemaWithDays({ id: 'schema-1', days: [] });
      useSchemaStore.setState({ currentSchema: schema });

      const newDay = createWorkoutDay({ id: 'new-day', name: 'Day B' });
      mockedDb.createWorkoutDay.mockResolvedValue(newDay);

      await act(async () => {
        await useSchemaStore.getState().addWorkoutDay('schema-1', 'Day B');
      });

      const days = useSchemaStore.getState().currentSchema?.days;
      expect(days).toHaveLength(1);
      expect(days?.[0].name).toBe('Day B');
      expect(days?.[0].exercises).toEqual([]);
    });

    it('should not modify state if currentSchema does not match', async () => {
      const schema = createSchemaWithDays({ id: 'schema-1' });
      useSchemaStore.setState({ currentSchema: schema });

      const newDay = createWorkoutDay();
      mockedDb.createWorkoutDay.mockResolvedValue(newDay);

      await act(async () => {
        await useSchemaStore.getState().addWorkoutDay('different-schema', 'Day B');
      });

      // Days should be unchanged
      expect(useSchemaStore.getState().currentSchema?.days).toEqual(schema.days);
    });
  });

  describe('updateWorkoutDay', () => {
    it('should update workout day in currentSchema', async () => {
      const schema = createSchemaWithDays({
        days: [{ ...createWorkoutDay({ id: 'day-1', name: 'Original' }), exercises: [] }],
      });
      useSchemaStore.setState({ currentSchema: schema });
      mockedDb.updateWorkoutDay.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().updateWorkoutDay('day-1', { name: 'Updated' });
      });

      const day = useSchemaStore.getState().currentSchema?.days[0];
      expect(day?.name).toBe('Updated');
    });
  });

  describe('deleteWorkoutDay', () => {
    it('should delete workout day from currentSchema', async () => {
      const schema = createSchemaWithDays({
        days: [
          { ...createWorkoutDay({ id: 'day-1' }), exercises: [] },
          { ...createWorkoutDay({ id: 'day-2' }), exercises: [] },
        ],
      });
      useSchemaStore.setState({ currentSchema: schema });
      mockedDb.deleteWorkoutDay.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().deleteWorkoutDay('day-1');
      });

      const days = useSchemaStore.getState().currentSchema?.days;
      expect(days).toHaveLength(1);
      expect(days?.[0].id).toBe('day-2');
    });
  });

  describe('addExercise', () => {
    it('should add exercise to correct day', async () => {
      const schema = createSchemaWithDays({
        days: [{ ...createWorkoutDay({ id: 'day-1' }), exercises: [] }],
      });
      useSchemaStore.setState({ currentSchema: schema });

      const newExercise = createExercise({ id: 'new-exercise' });
      mockedDb.createExercise.mockResolvedValue(newExercise);

      await act(async () => {
        await useSchemaStore.getState().addExercise('day-1', {
          name: 'Squat',
          equipmentType: 'plates',
          baseWeight: 20,
          targetSets: 3,
          targetRepsMin: 5,
          targetRepsMax: 7,
          progressiveLoadingEnabled: true,
          progressionIncrement: 2.5,
          currentWeight: 60,
        });
      });

      const exercises = useSchemaStore.getState().currentSchema?.days[0].exercises;
      expect(exercises).toHaveLength(1);
      expect(exercises?.[0].id).toBe('new-exercise');
    });
  });

  describe('updateExercise', () => {
    it('should update exercise in currentSchema', async () => {
      const exercise = createExercise({ id: 'exercise-1', name: 'Original' });
      const schema = createSchemaWithDays({
        days: [{ ...createWorkoutDay(), exercises: [exercise] }],
      });
      useSchemaStore.setState({ currentSchema: schema });
      mockedDb.updateExercise.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().updateExercise('exercise-1', { name: 'Updated' });
      });

      const updated = useSchemaStore.getState().currentSchema?.days[0].exercises[0];
      expect(updated?.name).toBe('Updated');
    });
  });

  describe('deleteExercise', () => {
    it('should delete exercise from currentSchema', async () => {
      const exercise1 = createExercise({ id: 'exercise-1' });
      const exercise2 = createExercise({ id: 'exercise-2' });
      const schema = createSchemaWithDays({
        days: [{ ...createWorkoutDay(), exercises: [exercise1, exercise2] }],
      });
      useSchemaStore.setState({ currentSchema: schema });
      mockedDb.deleteExercise.mockResolvedValue(undefined);

      await act(async () => {
        await useSchemaStore.getState().deleteExercise('exercise-1');
      });

      const exercises = useSchemaStore.getState().currentSchema?.days[0].exercises;
      expect(exercises).toHaveLength(1);
      expect(exercises?.[0].id).toBe('exercise-2');
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useSchemaStore.setState({ error: 'Some error' });

      act(() => {
        useSchemaStore.getState().clearError();
      });

      expect(useSchemaStore.getState().error).toBe(null);
    });
  });

  describe('clearCurrentSchema', () => {
    it('should clear currentSchema', () => {
      useSchemaStore.setState({ currentSchema: createSchemaWithDays() });

      act(() => {
        useSchemaStore.getState().clearCurrentSchema();
      });

      expect(useSchemaStore.getState().currentSchema).toBe(null);
    });
  });
});
