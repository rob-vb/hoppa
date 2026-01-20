import type { EquipmentType } from '@/db/types';

// Claude API configuration
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'EXPO_PUBLIC_CLAUDE_API_KEY is not set. Please add it to your .env.local file.'
    );
  }
  return apiKey;
}

// Types for Claude API
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ClaudeContent[];
}

export type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ClaudeImageSource };

export interface ClaudeImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: { type: 'text'; text: string }[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeError {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// Extracted schema types for AI import
export interface ExtractedExercise {
  name: string;
  equipmentType: EquipmentType;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  suggestedWeight?: number;
}

export interface ExtractedDay {
  name: string;
  exercises: ExtractedExercise[];
}

export interface ExtractedSchema {
  name: string;
  days: ExtractedDay[];
}

export interface SchemaExtractionResult {
  success: true;
  schema: ExtractedSchema;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
}

export interface SchemaExtractionError {
  success: false;
  error: string;
  details?: string;
}

export type SchemaExtractionResponse = SchemaExtractionResult | SchemaExtractionError;

// System prompt for schema extraction
const SCHEMA_EXTRACTION_PROMPT = `You are an expert fitness workout schema extraction assistant. Your task is to analyze images of workout plans (handwritten notes, printed programs, screenshots, PDFs, trainer templates) and extract structured data that can be used in a workout tracking app.

## YOUR TASK
Extract workout information from the image and return it as structured JSON. The app tracks progressive overload, so accurate sets and rep ranges are critical.

## WHAT TO EXTRACT

### 1. Schema Name
- Use the program name if visible (e.g., "PPL Strength", "Starting Strength", "PHUL")
- If no name is visible, generate a descriptive one based on the structure:
  - "Push Pull Legs" for PPL splits
  - "Upper Lower Split" for upper/lower programs
  - "Full Body Program" for full body routines
  - "Bro Split" for body-part splits (chest day, back day, etc.)
  - "[X]-Day Program" as a fallback

### 2. Workout Days
- Extract day names as written (e.g., "Day 1", "Push", "Chest & Triceps", "Upper A")
- Preserve the original naming if meaningful
- If days are just numbered, use "Day 1", "Day 2", etc.

### 3. Exercises (for each exercise, extract):
- **name**: The exercise name, normalized to standard naming:
  - "Bench Press" not "Flat BB Bench" or "Barbell Bench Press"
  - "Incline Dumbbell Press" not "Incline DB Press"
  - "Lat Pulldown" not "Lat Pull Down" or "Pulldown"
  - "Romanian Deadlift" not "RDL" or "Stiff Leg DL"
  - Expand common abbreviations (DB = Dumbbell, BB = Barbell, OHP = Overhead Press)

- **equipmentType**: Classify as one of:
  - "plates": Barbell exercises, dumbbell exercises (user loads weight plates)
    Examples: Bench Press, Squat, Deadlift, Barbell Row, Dumbbell Curl, Overhead Press
  - "machine": Pin-loaded or plate-loaded machines with a fixed movement path
    Examples: Leg Press, Lat Pulldown, Cable Fly, Chest Press Machine, Leg Extension, Leg Curl
  - "other": Bodyweight, cables with attachments, bands, kettlebells, or unclear
    Examples: Pull-ups, Dips, Push-ups, Face Pulls, Tricep Pushdown, Lateral Raises

- **targetSets**: Number of working sets (exclude warm-up sets if indicated)
- **targetRepsMin**: Minimum of rep range
- **targetRepsMax**: Maximum of rep range
- **suggestedWeight**: Starting weight in kg if mentioned (optional)

## SPECIAL CASES

### Rep Ranges
- "3x8-12" → targetSets: 3, targetRepsMin: 8, targetRepsMax: 12
- "4x10" → targetSets: 4, targetRepsMin: 10, targetRepsMax: 10
- "3x6-8" → targetSets: 3, targetRepsMin: 6, targetRepsMax: 8
- "AMRAP" or "to failure" → use targetRepsMin: 8, targetRepsMax: 15 (or best estimate)

### Supersets / Giant Sets
- Extract each exercise separately, in order
- Note: the app doesn't support superset grouping, so just list them sequentially

### Dropsets / Rest-Pause
- Count as a single set with the initial rep target

### Tempo / Pauses
- Ignore tempo notations (e.g., "3-1-2-0"), extract only sets and reps

### Warm-up Sets
- Exclude if clearly marked as warm-up
- Include if it's part of the working sets

## EQUIPMENT TYPE INFERENCE RULES

When equipment isn't explicitly stated, infer from exercise name:
- Contains "Barbell", "BB", "Bar": → "plates"
- Contains "Dumbbell", "DB": → "plates"
- Contains "Machine", "Cable", "Lat Pulldown", "Leg Press", "Leg Extension", "Leg Curl", "Chest Press Machine", "Pec Deck": → "machine"
- Contains "Pull-up", "Chin-up", "Dip", "Push-up", "Plank", "Bodyweight": → "other"
- Squat (unspecified): → "plates" (assume barbell)
- Bench Press (unspecified): → "plates" (assume barbell)
- Deadlift (unspecified): → "plates" (assume barbell)
- Row (unspecified): → "plates" (assume barbell)
- Curl (unspecified): → "plates" (assume dumbbell)
- Lateral Raise, Front Raise: → "other" (assume dumbbell/cable)
- Face Pull, Tricep Pushdown, Cable Fly: → "machine" (cable machine)

## DEFAULTS (when information is missing)
- Sets: 3
- Rep range: 8-12
- Equipment type: "other"
- Weight: omit (don't guess)

## CONFIDENCE LEVELS
- "high": Clear image, all exercises readable, standard format
- "medium": Some exercises unclear, or unusual format, or partially visible
- "low": Poor image quality, handwriting hard to read, or significant guessing required

## WARNINGS
Add warnings array for:
- Exercises that were hard to read
- Assumed equipment types
- Unusual rep schemes that were interpreted
- Missing information that was defaulted

## RESPONSE FORMAT

Return ONLY a JSON object (no markdown, no explanation):

{
  "success": true,
  "schema": {
    "name": "Schema Name",
    "days": [
      {
        "name": "Day 1",
        "exercises": [
          {
            "name": "Exercise Name",
            "equipmentType": "plates",
            "targetSets": 3,
            "targetRepsMin": 8,
            "targetRepsMax": 12,
            "suggestedWeight": 60
          }
        ]
      }
    ]
  },
  "confidence": "high",
  "warnings": []
}

## ERROR RESPONSE

If you cannot extract a valid workout schema, respond with:
{
  "success": false,
  "error": "Brief error description",
  "details": "What went wrong and what the user can do (e.g., 'Image is too blurry. Please retake with better lighting.')"
}

Common errors:
- "No workout plan detected" - Image doesn't contain workout information
- "Image too blurry" - Cannot read text
- "Partial extraction only" - Could only read some exercises (still return what you could extract with success: true and warnings)
- "Unsupported format" - Image contains workout info but in an unrecognizable format`;

// Call Claude API
async function callClaudeAPI(request: ClaudeRequest): Promise<ClaudeResponse> {
  const apiKey = getApiKey();

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ClaudeError;
    throw new Error(
      `Claude API error: ${errorData.error?.message || response.statusText}`
    );
  }

  return response.json() as Promise<ClaudeResponse>;
}

// Extract schema from image
export async function extractSchemaFromImage(
  imageBase64: string,
  mediaType: ClaudeImageSource['media_type'] = 'image/jpeg'
): Promise<SchemaExtractionResponse> {
  try {
    const request: ClaudeRequest = {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SCHEMA_EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Please extract the workout schema from this image.',
            },
          ],
        },
      ],
    };

    const response = await callClaudeAPI(request);

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent) {
      return {
        success: false,
        error: 'No text response from Claude',
        details: 'The API response did not contain text content',
      };
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Invalid response format',
        details: 'Could not find JSON in response',
      };
    }

    const result = JSON.parse(jsonMatch[0]) as SchemaExtractionResponse;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: 'Failed to extract schema',
      details: message,
    };
  }
}

// Send a text message to Claude (for general queries)
export async function sendMessage(
  message: string,
  systemPrompt?: string
): Promise<string> {
  const request: ClaudeRequest = {
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: message }],
      },
    ],
  };

  if (systemPrompt) {
    request.system = systemPrompt;
  }

  const response = await callClaudeAPI(request);
  const textContent = response.content.find((c) => c.type === 'text');
  return textContent?.text || '';
}

// Check if API key is configured
export function isApiKeyConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
