import * as SQLite from 'expo-sqlite';
import {
  Schema,
  WorkoutDay,
  Exercise,
  WorkoutSession,
  ExerciseLog,
  SetLog,
  SchemaWithDays,
  WorkoutDayWithExercises,
  ExerciseLogWithSets,
  WorkoutSessionWithLogs,
  EquipmentType,
  WorkoutStatus,
  ExerciseLogStatus,
} from './types';

const DATABASE_NAME = 'hoppa.db';

let db: SQLite.SQLiteDatabase | null = null;

// Generate UUID for new records
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initialize database connection
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await initializeTables();
  return db;
}

// Create all tables
async function initializeTables(): Promise<void> {
  if (!db) return;

  await db.execAsync(`
    -- Schemas
    CREATE TABLE IF NOT EXISTS schemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      progressive_loading_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Workout Days
    CREATE TABLE IF NOT EXISTS workout_days (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL
    );

    -- Exercises
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      equipment_type TEXT NOT NULL CHECK (equipment_type IN ('plates', 'machine', 'other')),
      base_weight REAL NOT NULL DEFAULT 0,
      target_sets INTEGER NOT NULL,
      target_reps_min INTEGER NOT NULL,
      target_reps_max INTEGER NOT NULL,
      progressive_loading_enabled INTEGER NOT NULL DEFAULT 1,
      progression_increment REAL NOT NULL DEFAULT 2.5,
      current_weight REAL NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL
    );

    -- Workout Sessions
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id),
      day_id TEXT NOT NULL REFERENCES workout_days(id),
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed'))
    );

    -- Exercise Logs
    CREATE TABLE IF NOT EXISTS exercise_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
      microplate_used REAL NOT NULL DEFAULT 0,
      total_weight REAL NOT NULL,
      progression_earned INTEGER NOT NULL DEFAULT 0
    );

    -- Set Logs
    CREATE TABLE IF NOT EXISTS set_logs (
      id TEXT PRIMARY KEY,
      exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      target_reps TEXT NOT NULL,
      completed_reps INTEGER
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_workout_days_schema ON workout_days(schema_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_day ON exercises(day_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_schema ON workout_sessions(schema_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_day ON workout_sessions(day_id);
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_log ON set_logs(exercise_log_id);
  `);
}

// ============================================
// Schema Operations
// ============================================

export async function createSchema(
  name: string,
  progressiveLoadingEnabled: boolean = true
): Promise<Schema> {
  const database = await getDatabase();
  const id = generateId();
  const now = Date.now();

  await database.runAsync(
    `INSERT INTO schemas (id, name, progressive_loading_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, progressiveLoadingEnabled ? 1 : 0, now, now]
  );

  return {
    id,
    name,
    progressiveLoadingEnabled,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSchemas(): Promise<Schema[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    progressive_loading_enabled: number;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM schemas ORDER BY updated_at DESC');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    progressiveLoadingEnabled: row.progressive_loading_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getSchemaById(id: string): Promise<Schema | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    progressive_loading_enabled: number;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM schemas WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    progressiveLoadingEnabled: row.progressive_loading_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSchemaWithDays(id: string): Promise<SchemaWithDays | null> {
  const schema = await getSchemaById(id);
  if (!schema) return null;

  const days = await getWorkoutDaysBySchema(id);
  const daysWithExercises: WorkoutDayWithExercises[] = await Promise.all(
    days.map(async (day) => {
      const exercises = await getExercisesByDay(day.id);
      return { ...day, exercises };
    })
  );

  return { ...schema, days: daysWithExercises };
}

export async function updateSchema(
  id: string,
  updates: Partial<Pick<Schema, 'name' | 'progressiveLoadingEnabled'>>
): Promise<void> {
  const database = await getDatabase();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [Date.now()];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.progressiveLoadingEnabled !== undefined) {
    setClauses.push('progressive_loading_enabled = ?');
    values.push(updates.progressiveLoadingEnabled ? 1 : 0);
  }

  values.push(id);
  await database.runAsync(
    `UPDATE schemas SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteSchema(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM schemas WHERE id = ?', [id]);
}

// ============================================
// Workout Day Operations
// ============================================

export async function createWorkoutDay(
  schemaId: string,
  name: string,
  orderIndex?: number
): Promise<WorkoutDay> {
  const database = await getDatabase();
  const id = generateId();

  // If orderIndex not provided, calculate from existing days to avoid race conditions
  let actualOrderIndex = orderIndex;
  if (actualOrderIndex === undefined) {
    const result = await database.getFirstAsync<{ maxOrder: number | null }>(
      'SELECT MAX(order_index) as maxOrder FROM workout_days WHERE schema_id = ?',
      [schemaId]
    );
    actualOrderIndex = (result?.maxOrder ?? -1) + 1;
  }

  await database.runAsync(
    `INSERT INTO workout_days (id, schema_id, name, order_index)
     VALUES (?, ?, ?, ?)`,
    [id, schemaId, name, actualOrderIndex]
  );

  // Update schema's updated_at
  await database.runAsync(
    'UPDATE schemas SET updated_at = ? WHERE id = ?',
    [Date.now(), schemaId]
  );

  return { id, schemaId, name, orderIndex: actualOrderIndex };
}

export async function getWorkoutDaysBySchema(schemaId: string): Promise<WorkoutDay[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    name: string;
    order_index: number;
  }>('SELECT * FROM workout_days WHERE schema_id = ? ORDER BY order_index', [schemaId]);

  return rows.map((row) => ({
    id: row.id,
    schemaId: row.schema_id,
    name: row.name,
    orderIndex: row.order_index,
  }));
}

export async function getWorkoutDayById(id: string): Promise<WorkoutDay | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    schema_id: string;
    name: string;
    order_index: number;
  }>('SELECT * FROM workout_days WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    schemaId: row.schema_id,
    name: row.name,
    orderIndex: row.order_index,
  };
}

export async function updateWorkoutDay(
  id: string,
  updates: Partial<Pick<WorkoutDay, 'name' | 'orderIndex'>>
): Promise<void> {
  const database = await getDatabase();
  const setClauses: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.orderIndex !== undefined) {
    setClauses.push('order_index = ?');
    values.push(updates.orderIndex);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await database.runAsync(
    `UPDATE workout_days SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteWorkoutDay(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM workout_days WHERE id = ?', [id]);
}

// ============================================
// Exercise Operations
// ============================================

export async function createExercise(exercise: Omit<Exercise, 'id'> & { orderIndex?: number }): Promise<Exercise> {
  const database = await getDatabase();
  const id = generateId();

  // If orderIndex not provided, calculate from existing exercises to avoid race conditions
  let actualOrderIndex = exercise.orderIndex;
  if (actualOrderIndex === undefined) {
    const result = await database.getFirstAsync<{ maxOrder: number | null }>(
      'SELECT MAX(order_index) as maxOrder FROM exercises WHERE day_id = ?',
      [exercise.dayId]
    );
    actualOrderIndex = (result?.maxOrder ?? -1) + 1;
  }

  await database.runAsync(
    `INSERT INTO exercises (id, day_id, name, equipment_type, base_weight, target_sets,
     target_reps_min, target_reps_max, progressive_loading_enabled, progression_increment,
     current_weight, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      exercise.dayId,
      exercise.name,
      exercise.equipmentType,
      exercise.baseWeight,
      exercise.targetSets,
      exercise.targetRepsMin,
      exercise.targetRepsMax,
      exercise.progressiveLoadingEnabled ? 1 : 0,
      exercise.progressionIncrement,
      exercise.currentWeight,
      actualOrderIndex,
    ]
  );

  return { id, ...exercise, orderIndex: actualOrderIndex };
}

export async function getExercisesByDay(dayId: string): Promise<Exercise[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    day_id: string;
    name: string;
    equipment_type: EquipmentType;
    base_weight: number;
    target_sets: number;
    target_reps_min: number;
    target_reps_max: number;
    progressive_loading_enabled: number;
    progression_increment: number;
    current_weight: number;
    order_index: number;
  }>('SELECT * FROM exercises WHERE day_id = ? ORDER BY order_index', [dayId]);

  return rows.map((row) => ({
    id: row.id,
    dayId: row.day_id,
    name: row.name,
    equipmentType: row.equipment_type,
    baseWeight: row.base_weight,
    targetSets: row.target_sets,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    progressiveLoadingEnabled: row.progressive_loading_enabled === 1,
    progressionIncrement: row.progression_increment,
    currentWeight: row.current_weight,
    orderIndex: row.order_index,
  }));
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    day_id: string;
    name: string;
    equipment_type: EquipmentType;
    base_weight: number;
    target_sets: number;
    target_reps_min: number;
    target_reps_max: number;
    progressive_loading_enabled: number;
    progression_increment: number;
    current_weight: number;
    order_index: number;
  }>('SELECT * FROM exercises WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    dayId: row.day_id,
    name: row.name,
    equipmentType: row.equipment_type,
    baseWeight: row.base_weight,
    targetSets: row.target_sets,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    progressiveLoadingEnabled: row.progressive_loading_enabled === 1,
    progressionIncrement: row.progression_increment,
    currentWeight: row.current_weight,
    orderIndex: row.order_index,
  };
}

export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id' | 'dayId'>>
): Promise<void> {
  const database = await getDatabase();
  const setClauses: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.equipmentType !== undefined) {
    setClauses.push('equipment_type = ?');
    values.push(updates.equipmentType);
  }
  if (updates.baseWeight !== undefined) {
    setClauses.push('base_weight = ?');
    values.push(updates.baseWeight);
  }
  if (updates.targetSets !== undefined) {
    setClauses.push('target_sets = ?');
    values.push(updates.targetSets);
  }
  if (updates.targetRepsMin !== undefined) {
    setClauses.push('target_reps_min = ?');
    values.push(updates.targetRepsMin);
  }
  if (updates.targetRepsMax !== undefined) {
    setClauses.push('target_reps_max = ?');
    values.push(updates.targetRepsMax);
  }
  if (updates.progressiveLoadingEnabled !== undefined) {
    setClauses.push('progressive_loading_enabled = ?');
    values.push(updates.progressiveLoadingEnabled ? 1 : 0);
  }
  if (updates.progressionIncrement !== undefined) {
    setClauses.push('progression_increment = ?');
    values.push(updates.progressionIncrement);
  }
  if (updates.currentWeight !== undefined) {
    setClauses.push('current_weight = ?');
    values.push(updates.currentWeight);
  }
  if (updates.orderIndex !== undefined) {
    setClauses.push('order_index = ?');
    values.push(updates.orderIndex);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await database.runAsync(
    `UPDATE exercises SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteExercise(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
}

// ============================================
// Workout Session Operations
// ============================================

export async function createWorkoutSession(
  schemaId: string,
  dayId: string
): Promise<WorkoutSession> {
  const database = await getDatabase();
  const id = generateId();
  const now = Date.now();

  await database.runAsync(
    `INSERT INTO workout_sessions (id, schema_id, day_id, started_at, completed_at, status)
     VALUES (?, ?, ?, ?, NULL, 'in_progress')`,
    [id, schemaId, dayId, now]
  );

  return {
    id,
    schemaId,
    dayId,
    startedAt: now,
    completedAt: null,
    status: 'in_progress',
  };
}

export async function getWorkoutSessions(limit?: number): Promise<WorkoutSession[]> {
  const database = await getDatabase();
  const query = limit
    ? `SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT ?`
    : `SELECT * FROM workout_sessions ORDER BY started_at DESC`;
  const params = limit ? [limit] : [];

  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>(query, params);

  return rows.map((row) => ({
    id: row.id,
    schemaId: row.schema_id,
    dayId: row.day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  }));
}

export async function getWorkoutSessionById(id: string): Promise<WorkoutSession | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>('SELECT * FROM workout_sessions WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    schemaId: row.schema_id,
    dayId: row.day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

export async function getActiveWorkoutSession(): Promise<WorkoutSession | null> {
  const database = await getDatabase();
  // Order by started_at DESC to always get the most recent active session
  // This ensures consistent behavior if multiple in_progress sessions exist
  const row = await database.getFirstAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>("SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1");

  if (!row) return null;

  return {
    id: row.id,
    schemaId: row.schema_id,
    dayId: row.day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

export async function getLastWorkoutForDay(dayId: string): Promise<WorkoutSession | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>(
    `SELECT * FROM workout_sessions
     WHERE day_id = ? AND status = 'completed'
     ORDER BY completed_at DESC LIMIT 1`,
    [dayId]
  );

  if (!row) return null;

  return {
    id: row.id,
    schemaId: row.schema_id,
    dayId: row.day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

export async function completeWorkoutSession(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE workout_sessions SET status = 'completed', completed_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
}

// ============================================
// Exercise Log Operations
// ============================================

export async function createExerciseLog(
  sessionId: string,
  exerciseId: string,
  totalWeight: number,
  microplateUsed: number = 0
): Promise<ExerciseLog> {
  const database = await getDatabase();
  const id = generateId();

  await database.runAsync(
    `INSERT INTO exercise_logs (id, session_id, exercise_id, status, microplate_used, total_weight, progression_earned)
     VALUES (?, ?, ?, 'pending', ?, ?, 0)`,
    [id, sessionId, exerciseId, microplateUsed, totalWeight]
  );

  return {
    id,
    sessionId,
    exerciseId,
    status: 'pending',
    microplateUsed,
    totalWeight,
    progressionEarned: false,
  };
}

export async function getExerciseLogsBySession(sessionId: string): Promise<ExerciseLog[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    session_id: string;
    exercise_id: string;
    status: ExerciseLogStatus;
    microplate_used: number;
    total_weight: number;
    progression_earned: number;
  }>('SELECT * FROM exercise_logs WHERE session_id = ?', [sessionId]);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    status: row.status,
    microplateUsed: row.microplate_used,
    totalWeight: row.total_weight,
    progressionEarned: row.progression_earned === 1,
  }));
}

export async function getExerciseLogById(id: string): Promise<ExerciseLog | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    session_id: string;
    exercise_id: string;
    status: ExerciseLogStatus;
    microplate_used: number;
    total_weight: number;
    progression_earned: number;
  }>('SELECT * FROM exercise_logs WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    status: row.status,
    microplateUsed: row.microplate_used,
    totalWeight: row.total_weight,
    progressionEarned: row.progression_earned === 1,
  };
}

export async function updateExerciseLog(
  id: string,
  updates: Partial<Pick<ExerciseLog, 'status' | 'microplateUsed' | 'totalWeight' | 'progressionEarned'>>
): Promise<void> {
  const database = await getDatabase();
  const setClauses: string[] = [];
  const values: (string | number)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.microplateUsed !== undefined) {
    setClauses.push('microplate_used = ?');
    values.push(updates.microplateUsed);
  }
  if (updates.totalWeight !== undefined) {
    setClauses.push('total_weight = ?');
    values.push(updates.totalWeight);
  }
  if (updates.progressionEarned !== undefined) {
    setClauses.push('progression_earned = ?');
    values.push(updates.progressionEarned ? 1 : 0);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await database.runAsync(
    `UPDATE exercise_logs SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

// ============================================
// Set Log Operations
// ============================================

export async function createSetLog(
  exerciseLogId: string,
  setNumber: number,
  targetReps: string
): Promise<SetLog> {
  const database = await getDatabase();
  const id = generateId();

  await database.runAsync(
    `INSERT INTO set_logs (id, exercise_log_id, set_number, target_reps, completed_reps)
     VALUES (?, ?, ?, ?, NULL)`,
    [id, exerciseLogId, setNumber, targetReps]
  );

  return {
    id,
    exerciseLogId,
    setNumber,
    targetReps,
    completedReps: null,
  };
}

export async function getSetLogsByExerciseLog(exerciseLogId: string): Promise<SetLog[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    exercise_log_id: string;
    set_number: number;
    target_reps: string;
    completed_reps: number | null;
  }>('SELECT * FROM set_logs WHERE exercise_log_id = ? ORDER BY set_number', [exerciseLogId]);

  return rows.map((row) => ({
    id: row.id,
    exerciseLogId: row.exercise_log_id,
    setNumber: row.set_number,
    targetReps: row.target_reps,
    completedReps: row.completed_reps,
  }));
}

export async function updateSetLog(id: string, completedReps: number | null): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE set_logs SET completed_reps = ? WHERE id = ?', [
    completedReps,
    id,
  ]);
}

// ============================================
// Utility Functions
// ============================================

export async function getWorkoutSessionWithLogs(
  sessionId: string
): Promise<WorkoutSessionWithLogs | null> {
  const session = await getWorkoutSessionById(sessionId);
  if (!session) return null;

  const exerciseLogs = await getExerciseLogsBySession(sessionId);
  const exerciseLogsWithSets: ExerciseLogWithSets[] = await Promise.all(
    exerciseLogs.map(async (log) => {
      const sets = await getSetLogsByExerciseLog(log.id);
      return { ...log, sets };
    })
  );

  return { ...session, exerciseLogs: exerciseLogsWithSets };
}

export async function getCompletedSessionsInDateRange(
  startDate: number,
  endDate: number
): Promise<WorkoutSession[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>(
    `SELECT * FROM workout_sessions
     WHERE status = 'completed' AND completed_at >= ? AND completed_at <= ?
     ORDER BY completed_at DESC`,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    id: row.id,
    schemaId: row.schema_id,
    dayId: row.day_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  }));
}

// Close database connection (for cleanup)
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
