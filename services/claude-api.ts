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
const SCHEMA_EXTRACTION_PROMPT = `You are a fitness workout schema extraction assistant. Your task is to analyze images of workout plans and extract structured data.

Extract the following information from the image:
1. Schema name (overall workout plan name, or generate a descriptive one)
2. Workout days (e.g., "Day 1", "Push Day", "Upper Body A")
3. For each exercise:
   - Exercise name
   - Equipment type: "plates" (barbell/dumbbell), "machine", or "other" (bodyweight, cables, etc.)
   - Target sets (number)
   - Target rep range (min and max, e.g., 8-12 reps)
   - Suggested starting weight if mentioned (optional)

IMPORTANT RULES:
- If rep range is a single number (e.g., "10 reps"), use that number for both min and max
- Default to 3 sets if not specified
- Default to "other" equipment if unclear
- Be conservative with weight suggestions

Respond with ONLY a JSON object in this exact format:
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
            "equipmentType": "plates" | "machine" | "other",
            "targetSets": 3,
            "targetRepsMin": 8,
            "targetRepsMax": 12,
            "suggestedWeight": 20
          }
        ]
      }
    ]
  },
  "confidence": "high" | "medium" | "low",
  "warnings": ["Optional warning messages"]
}

If you cannot extract a valid workout schema from the image, respond with:
{
  "success": false,
  "error": "Brief error description",
  "details": "More detailed explanation"
}`;

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
