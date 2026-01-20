export {
  extractSchemaFromImage,
  sendMessage,
  isApiKeyConfigured,
  type ClaudeMessage,
  type ClaudeContent,
  type ClaudeImageSource,
  type ExtractedSchema,
  type ExtractedDay,
  type ExtractedExercise,
  type SchemaExtractionResult,
  type SchemaExtractionError,
  type SchemaExtractionResponse,
} from './claude-api';

export {
  parseAIResponseJSON,
  parseAISchemaResponse,
  parseAndConvertAIResponse,
  convertExtractedSchemaToLocal,
  type LocalExercise,
  type LocalWorkoutDay,
  type ParsedSchemaResult,
  type ParsedSchemaError,
  type ParseSchemaResult,
} from './schema-parser';
