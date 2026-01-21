// Database types for Hoppa fitness app
// Maps to SQLite tables defined in db/database.ts

export type EquipmentType = 'plates' | 'machine' | 'other';
export type WorkoutStatus = 'in_progress' | 'completed';
export type ExerciseLogStatus = 'pending' | 'completed' | 'skipped';

// Schema - workout template
export interface Schema {
  id: string;
  name: string;
  progressiveLoadingEnabled: boolean;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

// Workout Day - a day within a schema
export interface WorkoutDay {
  id: string;
  schemaId: string;
  name: string;
  orderIndex: number;
  updatedAt: number; // Unix timestamp for conflict resolution
}

// Exercise - an exercise within a workout day
export interface Exercise {
  id: string;
  dayId: string;
  name: string;
  notes: string | null; // Form cues and notes for the exercise
  equipmentType: EquipmentType;
  baseWeight: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  progressiveLoadingEnabled: boolean;
  progressionIncrement: number;
  currentWeight: number;
  orderIndex: number;
  updatedAt: number; // Unix timestamp for conflict resolution
}

// Workout Session - a single workout instance
export interface WorkoutSession {
  id: string;
  schemaId: string;
  dayId: string;
  startedAt: number; // Unix timestamp
  completedAt: number | null; // Unix timestamp or null if in progress
  status: WorkoutStatus;
}

// Exercise Log - log of an exercise within a session
export interface ExerciseLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  status: ExerciseLogStatus;
  microplateUsed: number;
  totalWeight: number;
  progressionEarned: boolean;
  updatedAt: number; // Unix timestamp for conflict resolution
}

// Set Log - log of a single set within an exercise
export interface SetLog {
  id: string;
  exerciseLogId: string;
  setNumber: number;
  targetReps: string; // e.g., "6-8"
  completedReps: number | null;
  updatedAt: number; // Unix timestamp for conflict resolution
}

// Extended types with relations for convenience
export interface WorkoutDayWithExercises extends WorkoutDay {
  exercises: Exercise[];
}

export interface SchemaWithDays extends Schema {
  days: WorkoutDayWithExercises[];
}

export interface ExerciseLogWithSets extends ExerciseLog {
  sets: SetLog[];
}

export interface WorkoutSessionWithLogs extends WorkoutSession {
  exerciseLogs: ExerciseLogWithSets[];
}
