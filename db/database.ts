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
      order_index INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
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
      order_index INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
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
      progression_earned INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- Set Logs
    CREATE TABLE IF NOT EXISTS set_logs (
      id TEXT PRIMARY KEY,
      exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      target_reps TEXT NOT NULL,
      completed_reps INTEGER,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_workout_days_schema ON workout_days(schema_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_day ON exercises(day_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_schema ON workout_sessions(schema_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_day ON workout_sessions(day_id);
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_log ON set_logs(exercise_log_id);

    -- Performance indexes for filtered/sorted queries
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON workout_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON workout_sessions(completed_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_status_completed ON workout_sessions(status, completed_at);
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise ON exercise_logs(exercise_id);

    -- Composite index for getLastWorkoutForDay queries (day_id + status + completed_at)
    CREATE INDEX IF NOT EXISTS idx_sessions_day_status_completed ON workout_sessions(day_id, status, completed_at DESC);

    -- Index for calendar queries (started_at date range)
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON workout_sessions(started_at);
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
  const now = Date.now();

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
    `INSERT INTO workout_days (id, schema_id, name, order_index, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, schemaId, name, actualOrderIndex, now]
  );

  // Update schema's updated_at
  await database.runAsync(
    'UPDATE schemas SET updated_at = ? WHERE id = ?',
    [now, schemaId]
  );

  return { id, schemaId, name, orderIndex: actualOrderIndex, updatedAt: now };
}

export async function getWorkoutDaysBySchema(schemaId: string): Promise<WorkoutDay[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    name: string;
    order_index: number;
    updated_at: number;
  }>('SELECT * FROM workout_days WHERE schema_id = ? ORDER BY order_index', [schemaId]);

  return rows.map((row) => ({
    id: row.id,
    schemaId: row.schema_id,
    name: row.name,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
  }));
}

export async function getWorkoutDayById(id: string): Promise<WorkoutDay | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    schema_id: string;
    name: string;
    order_index: number;
    updated_at: number;
  }>('SELECT * FROM workout_days WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    schemaId: row.schema_id,
    name: row.name,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
  };
}

export async function updateWorkoutDay(
  id: string,
  updates: Partial<Pick<WorkoutDay, 'name' | 'orderIndex'>>
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.orderIndex !== undefined) {
    setClauses.push('order_index = ?');
    values.push(updates.orderIndex);
  }

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

export async function createExercise(exercise: Omit<Exercise, 'id' | 'updatedAt'> & { orderIndex?: number }): Promise<Exercise> {
  const database = await getDatabase();
  const id = generateId();
  const now = Date.now();

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
     current_weight, order_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      now,
    ]
  );

  return { id, ...exercise, orderIndex: actualOrderIndex, updatedAt: now };
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
    updated_at: number;
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
    updatedAt: row.updated_at,
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
    updated_at: number;
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
    updatedAt: row.updated_at,
  };
}

export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id' | 'dayId'>>
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

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
  const now = Date.now();

  await database.runAsync(
    `INSERT INTO exercise_logs (id, session_id, exercise_id, status, microplate_used, total_weight, progression_earned, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, 0, ?)`,
    [id, sessionId, exerciseId, microplateUsed, totalWeight, now]
  );

  return {
    id,
    sessionId,
    exerciseId,
    status: 'pending',
    microplateUsed,
    totalWeight,
    progressionEarned: false,
    updatedAt: now,
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
    updated_at: number;
  }>('SELECT * FROM exercise_logs WHERE session_id = ?', [sessionId]);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    status: row.status,
    microplateUsed: row.microplate_used,
    totalWeight: row.total_weight,
    progressionEarned: row.progression_earned === 1,
    updatedAt: row.updated_at,
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
    updated_at: number;
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
    updatedAt: row.updated_at,
  };
}

export async function updateExerciseLog(
  id: string,
  updates: Partial<Pick<ExerciseLog, 'status' | 'microplateUsed' | 'totalWeight' | 'progressionEarned'>>
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

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
  const now = Date.now();

  await database.runAsync(
    `INSERT INTO set_logs (id, exercise_log_id, set_number, target_reps, completed_reps, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [id, exerciseLogId, setNumber, targetReps, now]
  );

  return {
    id,
    exerciseLogId,
    setNumber,
    targetReps,
    completedReps: null,
    updatedAt: now,
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
    updated_at: number;
  }>('SELECT * FROM set_logs WHERE exercise_log_id = ? ORDER BY set_number', [exerciseLogId]);

  return rows.map((row) => ({
    id: row.id,
    exerciseLogId: row.exercise_log_id,
    setNumber: row.set_number,
    targetReps: row.target_reps,
    completedReps: row.completed_reps,
    updatedAt: row.updated_at,
  }));
}

export async function updateSetLog(id: string, completedReps: number | null): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE set_logs SET completed_reps = ?, updated_at = ? WHERE id = ?', [
    completedReps,
    Date.now(),
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

// ============================================
// Batch Operations (Performance Optimized)
// ============================================

/**
 * Batch fetch last workout sessions for multiple day IDs
 * Optimized to avoid N+1 queries when loading home screen
 */
export async function getLastWorkoutsForDays(
  dayIds: string[]
): Promise<Map<string, WorkoutSession>> {
  if (dayIds.length === 0) return new Map();

  const database = await getDatabase();
  const placeholders = dayIds.map(() => '?').join(',');

  // Use a subquery to get the most recent completed session for each day
  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>(
    `SELECT ws.*
     FROM workout_sessions ws
     INNER JOIN (
       SELECT day_id, MAX(completed_at) as max_completed
       FROM workout_sessions
       WHERE day_id IN (${placeholders}) AND status = 'completed'
       GROUP BY day_id
     ) latest ON ws.day_id = latest.day_id AND ws.completed_at = latest.max_completed
     WHERE ws.status = 'completed'`,
    dayIds
  );

  const result = new Map<string, WorkoutSession>();
  for (const row of rows) {
    result.set(row.day_id, {
      id: row.id,
      schemaId: row.schema_id,
      dayId: row.day_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
    });
  }
  return result;
}

/**
 * Batch fetch schemas by IDs
 * Returns a Map for O(1) lookups
 */
export async function getSchemasByIds(
  schemaIds: string[]
): Promise<Map<string, Schema>> {
  if (schemaIds.length === 0) return new Map();

  const database = await getDatabase();
  const uniqueIds = [...new Set(schemaIds)];
  const placeholders = uniqueIds.map(() => '?').join(',');

  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    progressive_loading_enabled: number;
    created_at: number;
    updated_at: number;
  }>(`SELECT * FROM schemas WHERE id IN (${placeholders})`, uniqueIds);

  const result = new Map<string, Schema>();
  for (const row of rows) {
    result.set(row.id, {
      id: row.id,
      name: row.name,
      progressiveLoadingEnabled: row.progressive_loading_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return result;
}

/**
 * Batch fetch workout days by IDs
 * Returns a Map for O(1) lookups
 */
export async function getWorkoutDaysByIds(
  dayIds: string[]
): Promise<Map<string, WorkoutDay>> {
  if (dayIds.length === 0) return new Map();

  const database = await getDatabase();
  const uniqueIds = [...new Set(dayIds)];
  const placeholders = uniqueIds.map(() => '?').join(',');

  const rows = await database.getAllAsync<{
    id: string;
    schema_id: string;
    name: string;
    order_index: number;
    updated_at: number;
  }>(`SELECT * FROM workout_days WHERE id IN (${placeholders})`, uniqueIds);

  const result = new Map<string, WorkoutDay>();
  for (const row of rows) {
    result.set(row.id, {
      id: row.id,
      schemaId: row.schema_id,
      name: row.name,
      orderIndex: row.order_index,
      updatedAt: row.updated_at,
    });
  }
  return result;
}

/**
 * Get completed sessions with all details in optimized batch queries
 * Replaces the N+1 pattern in history screen
 */
export async function getCompletedSessionsWithDetails(
  startDate: number,
  endDate: number
): Promise<
  Array<{
    session: WorkoutSession;
    schemaName: string;
    dayName: string;
    exerciseCount: number;
    completedCount: number;
    totalReps: number;
    progressionCount: number;
  }>
> {
  const database = await getDatabase();

  // Single query to get sessions with schema/day names and aggregated stats
  const rows = await database.getAllAsync<{
    session_id: string;
    schema_id: string;
    day_id: string;
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
    schema_name: string;
    day_name: string;
  }>(
    `SELECT
       ws.id as session_id,
       ws.schema_id,
       ws.day_id,
       ws.started_at,
       ws.completed_at,
       ws.status,
       s.name as schema_name,
       wd.name as day_name
     FROM workout_sessions ws
     JOIN schemas s ON ws.schema_id = s.id
     JOIN workout_days wd ON ws.day_id = wd.id
     WHERE ws.status = 'completed' AND ws.completed_at >= ? AND ws.completed_at <= ?
     ORDER BY ws.completed_at DESC`,
    [startDate, endDate]
  );

  if (rows.length === 0) return [];

  const sessionIds = rows.map((r) => r.session_id);
  const placeholders = sessionIds.map(() => '?').join(',');

  // Get exercise log stats in one query
  const exerciseStats = await database.getAllAsync<{
    session_id: string;
    exercise_count: number;
    completed_count: number;
    progression_count: number;
  }>(
    `SELECT
       session_id,
       COUNT(*) as exercise_count,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN progression_earned = 1 THEN 1 ELSE 0 END) as progression_count
     FROM exercise_logs
     WHERE session_id IN (${placeholders})
     GROUP BY session_id`,
    sessionIds
  );

  // Get total reps in one query
  const repStats = await database.getAllAsync<{
    session_id: string;
    total_reps: number;
  }>(
    `SELECT
       el.session_id,
       COALESCE(SUM(sl.completed_reps), 0) as total_reps
     FROM exercise_logs el
     LEFT JOIN set_logs sl ON el.id = sl.exercise_log_id
     WHERE el.session_id IN (${placeholders})
     GROUP BY el.session_id`,
    sessionIds
  );

  // Build lookup maps
  const exerciseStatsMap = new Map(exerciseStats.map((s) => [s.session_id, s]));
  const repStatsMap = new Map(repStats.map((s) => [s.session_id, s]));

  return rows.map((row) => {
    const stats = exerciseStatsMap.get(row.session_id);
    const reps = repStatsMap.get(row.session_id);

    return {
      session: {
        id: row.session_id,
        schemaId: row.schema_id,
        dayId: row.day_id,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        status: row.status,
      },
      schemaName: row.schema_name,
      dayName: row.day_name,
      exerciseCount: stats?.exercise_count ?? 0,
      completedCount: stats?.completed_count ?? 0,
      totalReps: reps?.total_reps ?? 0,
      progressionCount: stats?.progression_count ?? 0,
    };
  });
}

/**
 * Get all schemas with their days and last workout info
 * Optimized for home screen loading
 */
export async function getSchemasWithDaysAndLastWorkout(): Promise<
  Array<{
    schema: SchemaWithDays;
    lastWorkouts: Map<string, WorkoutSession>;
  }>
> {
  const schemas = await getSchemas();
  if (schemas.length === 0) return [];

  const result: Array<{
    schema: SchemaWithDays;
    lastWorkouts: Map<string, WorkoutSession>;
  }> = [];

  // Get all days for all schemas in parallel
  const schemasWithDays = await Promise.all(
    schemas.map((s) => getSchemaWithDays(s.id))
  );

  // Collect all day IDs
  const allDayIds: string[] = [];
  for (const schema of schemasWithDays) {
    if (schema) {
      for (const day of schema.days) {
        allDayIds.push(day.id);
      }
    }
  }

  // Batch fetch last workouts for all days
  const lastWorkoutsMap = await getLastWorkoutsForDays(allDayIds);

  // Build result
  for (const schema of schemasWithDays) {
    if (schema) {
      const schemaLastWorkouts = new Map<string, WorkoutSession>();
      for (const day of schema.days) {
        const lastWorkout = lastWorkoutsMap.get(day.id);
        if (lastWorkout) {
          schemaLastWorkouts.set(day.id, lastWorkout);
        }
      }
      result.push({
        schema,
        lastWorkouts: schemaLastWorkouts,
      });
    }
  }

  return result;
}

// Close database connection (for cleanup)
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// ============================================
// Dashboard Statistics Operations
// ============================================

export interface DashboardStats {
  workoutCount: number;
  progressionCount: number;
  totalVolume: number; // total reps * weight
  totalReps: number;
  // Comparison to previous period
  workoutCountDiff: number;
  progressionCountDiff: number;
  totalVolumeDiff: number;
  totalRepsDiff: number;
}

/**
 * Get dashboard statistics for a date range with comparison to previous period
 */
export async function getDashboardStats(
  startDate: number,
  endDate: number
): Promise<DashboardStats> {
  const database = await getDatabase();

  // Calculate previous period range (same duration, immediately before)
  const periodDuration = endDate - startDate;
  const prevStartDate = startDate - periodDuration;
  const prevEndDate = startDate;

  // Get current period stats
  const workoutResult = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM workout_sessions
     WHERE status = 'completed' AND completed_at >= ? AND completed_at <= ?`,
    [startDate, endDate]
  );

  const progressionResult = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercise_logs el
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE el.progression_earned = 1
     AND ws.status = 'completed'
     AND ws.completed_at >= ? AND ws.completed_at <= ?`,
    [startDate, endDate]
  );

  const volumeResult = await database.getFirstAsync<{
    total_volume: number | null;
    total_reps: number | null;
  }>(
    `SELECT
       COALESCE(SUM(sl.completed_reps * el.total_weight), 0) as total_volume,
       COALESCE(SUM(sl.completed_reps), 0) as total_reps
     FROM set_logs sl
     JOIN exercise_logs el ON sl.exercise_log_id = el.id
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE sl.completed_reps IS NOT NULL
     AND ws.status = 'completed'
     AND ws.completed_at >= ? AND ws.completed_at <= ?`,
    [startDate, endDate]
  );

  // Get previous period stats for comparison
  const prevWorkoutResult = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM workout_sessions
     WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
    [prevStartDate, prevEndDate]
  );

  const prevProgressionResult = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercise_logs el
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE el.progression_earned = 1
     AND ws.status = 'completed'
     AND ws.completed_at >= ? AND ws.completed_at < ?`,
    [prevStartDate, prevEndDate]
  );

  const prevVolumeResult = await database.getFirstAsync<{
    total_volume: number | null;
    total_reps: number | null;
  }>(
    `SELECT
       COALESCE(SUM(sl.completed_reps * el.total_weight), 0) as total_volume,
       COALESCE(SUM(sl.completed_reps), 0) as total_reps
     FROM set_logs sl
     JOIN exercise_logs el ON sl.exercise_log_id = el.id
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE sl.completed_reps IS NOT NULL
     AND ws.status = 'completed'
     AND ws.completed_at >= ? AND ws.completed_at < ?`,
    [prevStartDate, prevEndDate]
  );

  const workoutCount = workoutResult?.count ?? 0;
  const progressionCount = progressionResult?.count ?? 0;
  const totalVolume = Math.round(volumeResult?.total_volume ?? 0);
  const totalReps = volumeResult?.total_reps ?? 0;

  const prevWorkoutCount = prevWorkoutResult?.count ?? 0;
  const prevProgressionCount = prevProgressionResult?.count ?? 0;
  const prevTotalVolume = Math.round(prevVolumeResult?.total_volume ?? 0);
  const prevTotalReps = prevVolumeResult?.total_reps ?? 0;

  return {
    workoutCount,
    progressionCount,
    totalVolume,
    totalReps,
    workoutCountDiff: workoutCount - prevWorkoutCount,
    progressionCountDiff: progressionCount - prevProgressionCount,
    totalVolumeDiff: totalVolume - prevTotalVolume,
    totalRepsDiff: totalReps - prevTotalReps,
  };
}

export interface ExerciseProgressData {
  exerciseId: string;
  name: string;
  dayName: string;
  schemaName: string;
  currentWeight: number;
  startingWeight: number;
  progressionCount: number;
  progressionDates: number[];
  weightHistory: Array<{
    date: number;
    weight: number;
  }>;
}

/**
 * Get all exercises with their progress data
 * Optimized to use batch queries instead of N+1 pattern
 */
export async function getExercisesWithProgress(): Promise<ExerciseProgressData[]> {
  const database = await getDatabase();

  // Get all exercises with schema and day info
  const exercises = await database.getAllAsync<{
    exercise_id: string;
    exercise_name: string;
    current_weight: number;
    day_name: string;
    schema_name: string;
  }>(
    `SELECT
       e.id as exercise_id,
       e.name as exercise_name,
       e.current_weight,
       wd.name as day_name,
       s.name as schema_name
     FROM exercises e
     JOIN workout_days wd ON e.day_id = wd.id
     JOIN schemas s ON wd.schema_id = s.id
     ORDER BY s.name, wd.order_index, e.order_index`
  );

  if (exercises.length === 0) return [];

  // Batch query: Get all weight history for all exercises in one query
  const allHistoryRows = await database.getAllAsync<{
    exercise_id: string;
    completed_at: number;
    total_weight: number;
  }>(
    `SELECT el.exercise_id, ws.completed_at, el.total_weight
     FROM exercise_logs el
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE ws.status = 'completed'
     AND el.status = 'completed'
     ORDER BY el.exercise_id, ws.completed_at ASC`
  );

  // Batch query: Get all progression dates for all exercises in one query
  const allProgressionRows = await database.getAllAsync<{
    exercise_id: string;
    completed_at: number;
  }>(
    `SELECT el.exercise_id, ws.completed_at
     FROM exercise_logs el
     JOIN workout_sessions ws ON el.session_id = ws.id
     WHERE el.progression_earned = 1
     AND ws.status = 'completed'
     ORDER BY el.exercise_id, ws.completed_at ASC`
  );

  // Build lookup maps for O(1) access
  const historyByExercise = new Map<string, Array<{ date: number; weight: number }>>();
  for (const row of allHistoryRows) {
    if (!historyByExercise.has(row.exercise_id)) {
      historyByExercise.set(row.exercise_id, []);
    }
    historyByExercise.get(row.exercise_id)!.push({
      date: row.completed_at,
      weight: row.total_weight,
    });
  }

  const progressionsByExercise = new Map<string, number[]>();
  for (const row of allProgressionRows) {
    if (!progressionsByExercise.has(row.exercise_id)) {
      progressionsByExercise.set(row.exercise_id, []);
    }
    progressionsByExercise.get(row.exercise_id)!.push(row.completed_at);
  }

  // Build result using the pre-fetched data
  return exercises.map((exercise) => {
    const weightHistory = historyByExercise.get(exercise.exercise_id) ?? [];
    const progressionDates = progressionsByExercise.get(exercise.exercise_id) ?? [];
    const startingWeight = weightHistory.length > 0
      ? weightHistory[0].weight
      : exercise.current_weight;

    return {
      exerciseId: exercise.exercise_id,
      name: exercise.exercise_name,
      dayName: exercise.day_name,
      schemaName: exercise.schema_name,
      currentWeight: exercise.current_weight,
      startingWeight,
      progressionCount: progressionDates.length,
      progressionDates,
      weightHistory,
    };
  });
}

export interface CalendarDay {
  date: number;
  hasWorkout: boolean;
  isCompleted: boolean;
  workoutCount: number;
}

/**
 * Get workout calendar data for a month
 */
export async function getWorkoutCalendar(
  year: number,
  month: number
): Promise<CalendarDay[]> {
  const database = await getDatabase();

  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const sessions = await database.getAllAsync<{
    started_at: number;
    completed_at: number | null;
    status: WorkoutStatus;
  }>(
    `SELECT started_at, completed_at, status FROM workout_sessions
     WHERE started_at >= ? AND started_at <= ?`,
    [startOfMonth, endOfMonth]
  );

  // Group by day
  const dayMap = new Map<string, { hasWorkout: boolean; isCompleted: boolean; count: number }>();

  for (const session of sessions) {
    const date = new Date(session.started_at);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    const existing = dayMap.get(dayKey) || { hasWorkout: false, isCompleted: false, count: 0 };
    existing.hasWorkout = true;
    existing.count++;
    if (session.status === 'completed') {
      existing.isCompleted = true;
    }
    dayMap.set(dayKey, existing);
  }

  // Generate all days of the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const data = dayMap.get(dayKey);

    result.push({
      date: date.getTime(),
      hasWorkout: data?.hasWorkout ?? false,
      isCompleted: data?.isCompleted ?? false,
      workoutCount: data?.count ?? 0,
    });
  }

  return result;
}
