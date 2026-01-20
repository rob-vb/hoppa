import type { EquipmentType } from '@/db/types';
import type {
  ExtractedSchema,
  ExtractedDay,
  ExtractedExercise,
  SchemaExtractionResponse,
} from './claude-api';

// Local types used by the create schema screen
export interface LocalExercise {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  baseWeight: string;
  targetSets: string;
  targetRepsMin: string;
  targetRepsMax: string;
  progressiveLoadingEnabled: boolean;
  progressionIncrement: string;
}

export interface LocalWorkoutDay {
  id: string;
  name: string;
  exercises: LocalExercise[];
  isExpanded: boolean;
}

export interface ParsedSchemaResult {
  success: true;
  schemaName: string;
  days: LocalWorkoutDay[];
  warnings?: string[];
}

export interface ParsedSchemaError {
  success: false;
  error: string;
  details?: string;
}

export type ParseSchemaResult = ParsedSchemaResult | ParsedSchemaError;

// Generate a unique ID for local state
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Type guards for validating AI response structure
function isValidEquipmentType(value: unknown): value is EquipmentType {
  return value === 'plates' || value === 'machine' || value === 'other';
}

function isValidExtractedExercise(value: unknown): value is ExtractedExercise {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    isValidEquipmentType(obj.equipmentType) &&
    typeof obj.targetSets === 'number' &&
    obj.targetSets >= 1 &&
    typeof obj.targetRepsMin === 'number' &&
    obj.targetRepsMin >= 1 &&
    typeof obj.targetRepsMax === 'number' &&
    obj.targetRepsMax >= obj.targetRepsMin &&
    (obj.suggestedWeight === undefined || typeof obj.suggestedWeight === 'number')
  );
}

function isValidExtractedDay(value: unknown): value is ExtractedDay {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    Array.isArray(obj.exercises) &&
    obj.exercises.length > 0 &&
    obj.exercises.every(isValidExtractedExercise)
  );
}

function isValidExtractedSchema(value: unknown): value is ExtractedSchema {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    Array.isArray(obj.days) &&
    obj.days.length > 0 &&
    obj.days.every(isValidExtractedDay)
  );
}

function isValidSchemaExtractionResponse(value: unknown): value is SchemaExtractionResponse {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (obj.success === true) {
    return (
      isValidExtractedSchema(obj.schema) &&
      (obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low') &&
      (obj.warnings === undefined || Array.isArray(obj.warnings))
    );
  }

  if (obj.success === false) {
    return (
      typeof obj.error === 'string' &&
      (obj.details === undefined || typeof obj.details === 'string')
    );
  }

  return false;
}

/**
 * Parse and validate raw JSON text from Claude API into a SchemaExtractionResponse
 */
export function parseAIResponseJSON(jsonText: string): SchemaExtractionResponse {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      error: 'Invalid response format',
      details: 'Could not find JSON in response',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      success: false,
      error: 'Invalid JSON',
      details: 'Failed to parse JSON response',
    };
  }

  if (!isValidSchemaExtractionResponse(parsed)) {
    return {
      success: false,
      error: 'Invalid response structure',
      details: 'The AI response did not match the expected schema format',
    };
  }

  return parsed;
}

/**
 * Convert an ExtractedExercise to a LocalExercise for the create screen
 */
function convertExercise(exercise: ExtractedExercise): LocalExercise {
  return {
    id: generateId(),
    name: exercise.name.trim(),
    equipmentType: exercise.equipmentType,
    baseWeight: exercise.suggestedWeight?.toString() ?? '0',
    targetSets: exercise.targetSets.toString(),
    targetRepsMin: exercise.targetRepsMin.toString(),
    targetRepsMax: exercise.targetRepsMax.toString(),
    progressiveLoadingEnabled: true,
    progressionIncrement: '2.5',
  };
}

/**
 * Convert an ExtractedDay to a LocalWorkoutDay for the create screen
 */
function convertDay(day: ExtractedDay): LocalWorkoutDay {
  return {
    id: generateId(),
    name: day.name.trim(),
    exercises: day.exercises.map(convertExercise),
    isExpanded: true,
  };
}

/**
 * Convert an ExtractedSchema to the local format used by the create schema screen
 */
export function convertExtractedSchemaToLocal(
  schema: ExtractedSchema,
  warnings?: string[]
): ParsedSchemaResult {
  return {
    success: true,
    schemaName: schema.name.trim(),
    days: schema.days.map(convertDay),
    warnings,
  };
}

/**
 * Parse a SchemaExtractionResponse and convert to local format
 * This is the main function to use when processing AI responses
 */
export function parseAISchemaResponse(response: SchemaExtractionResponse): ParseSchemaResult {
  if (!response.success) {
    return {
      success: false,
      error: response.error,
      details: response.details,
    };
  }

  return convertExtractedSchemaToLocal(response.schema, response.warnings);
}

/**
 * Parse raw JSON text from AI and convert to local schema format
 * Combines JSON parsing, validation, and conversion in one step
 */
export function parseAndConvertAIResponse(jsonText: string): ParseSchemaResult {
  const response = parseAIResponseJSON(jsonText);
  return parseAISchemaResponse(response);
}
