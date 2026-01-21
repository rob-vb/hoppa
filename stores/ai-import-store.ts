import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  extractSchemaFromImage,
  isApiKeyConfigured,
  type ExtractedSchema,
  type SchemaExtractionResponse,
  type ClaudeImageSource,
} from '@/services/claude-api';

// Rate limiting constants
const FREE_TIER_MONTHLY_LIMIT = 3;
const UNLIMITED_IMPORTS = Number.MAX_SAFE_INTEGER;
const STORAGE_KEY_IMPORT_DATA = 'ai_import_data';

interface ImportData {
  count: number;
  monthYear: string; // Format: "2024-01"
}

// Error types for better categorization
export type ExtractionErrorType =
  | 'network'
  | 'api_error'
  | 'rate_limit'
  | 'api_not_configured'
  | 'unclear_image'
  | 'no_workout_detected'
  | 'partial_extraction'
  | 'parse_error'
  | 'unknown';

export interface ExtractionError {
  type: ExtractionErrorType;
  message: string;
  details?: string;
  isRetryable: boolean;
}

interface AIImportState {
  // Extraction state
  extractedSchema: ExtractedSchema | null;
  extractionError: ExtractionError | null;
  extractionConfidence: 'high' | 'medium' | 'low' | null;
  extractionWarnings: string[];
  isExtracting: boolean;

  // Rate limiting
  importsThisMonth: number;
  monthlyLimit: number;
  canImport: boolean;

  // Premium status
  isPremium: boolean;

  // API status
  isApiConfigured: boolean;
}

interface AIImportActions {
  // Core actions
  extractSchema: (
    imageBase64: string,
    mediaType?: ClaudeImageSource['media_type']
  ) => Promise<SchemaExtractionResponse>;
  clearExtractedSchema: () => void;
  clearError: () => void;

  // Rate limiting
  loadImportCount: () => Promise<void>;
  checkCanImport: () => boolean;

  // Premium status
  setPremiumStatus: (isPremium: boolean) => void;

  // API check
  checkApiConfiguration: () => void;
}

type AIImportStore = AIImportState & AIImportActions;

function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function loadStoredImportData(): Promise<ImportData> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY_IMPORT_DATA);
    if (stored) {
      return JSON.parse(stored) as ImportData;
    }
  } catch {
    // Ignore storage errors, return default
  }
  return { count: 0, monthYear: getCurrentMonthYear() };
}

async function saveImportData(data: ImportData): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY_IMPORT_DATA, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// Helper to categorize errors from API responses
function categorizeError(errorMessage: string, details?: string): ExtractionError {
  const lowerMessage = errorMessage.toLowerCase();
  const lowerDetails = (details || '').toLowerCase();

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('connection') ||
    lowerDetails.includes('network')
  ) {
    return {
      type: 'network',
      message: 'Unable to connect',
      details: 'Check your internet connection and try again.',
      isRetryable: true,
    };
  }

  // API errors (rate limits, auth, server errors)
  if (
    lowerMessage.includes('api error') ||
    lowerMessage.includes('401') ||
    lowerMessage.includes('403') ||
    lowerMessage.includes('500') ||
    lowerMessage.includes('503')
  ) {
    return {
      type: 'api_error',
      message: 'Service temporarily unavailable',
      details: 'Please try again in a moment.',
      isRetryable: true,
    };
  }

  // Unclear/blurry image
  if (
    lowerMessage.includes('blurry') ||
    lowerMessage.includes('unclear') ||
    lowerMessage.includes('cannot read') ||
    lowerDetails.includes('blurry') ||
    lowerDetails.includes('quality')
  ) {
    return {
      type: 'unclear_image',
      message: 'Image is unclear',
      details: 'Please take a clearer photo with better lighting.',
      isRetryable: true,
    };
  }

  // No workout detected
  if (
    lowerMessage.includes('no workout') ||
    lowerMessage.includes('not a workout') ||
    lowerMessage.includes('no exercises') ||
    lowerDetails.includes('no workout')
  ) {
    return {
      type: 'no_workout_detected',
      message: 'No workout plan detected',
      details: 'Make sure the image contains a workout plan with exercises, sets, and reps.',
      isRetryable: true,
    };
  }

  // Parse errors
  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('parse') ||
    lowerMessage.includes('json') ||
    lowerMessage.includes('format')
  ) {
    return {
      type: 'parse_error',
      message: 'Could not process the image',
      details: 'The AI had trouble understanding this format. Try a different image.',
      isRetryable: true,
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: errorMessage,
    details: details || 'An unexpected error occurred. Please try again.',
    isRetryable: true,
  };
}

export const useAIImportStore = create<AIImportStore>((set, get) => ({
  // Initial state
  extractedSchema: null,
  extractionError: null,
  extractionConfidence: null,
  extractionWarnings: [],
  isExtracting: false,
  importsThisMonth: 0,
  monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
  canImport: true,
  isPremium: false,
  isApiConfigured: false,

  // Extract schema from image
  extractSchema: async (imageBase64, mediaType = 'image/jpeg') => {
    const { checkCanImport, importsThisMonth } = get();

    // Check rate limit
    if (!checkCanImport()) {
      const error: SchemaExtractionResponse = {
        success: false,
        error: 'Monthly import limit reached',
        details: `You have used all ${FREE_TIER_MONTHLY_LIMIT} AI imports for this month. Limit resets next month.`,
      };
      set({
        extractionError: {
          type: 'rate_limit',
          message: 'Monthly import limit reached',
          details: `You have used all ${FREE_TIER_MONTHLY_LIMIT} AI imports for this month. Limit resets next month.`,
          isRetryable: false,
        },
      });
      return error;
    }

    // Check API configuration
    if (!isApiKeyConfigured()) {
      const error: SchemaExtractionResponse = {
        success: false,
        error: 'API not configured',
        details: 'Please add your Claude API key to .env.local',
      };
      set({
        extractionError: {
          type: 'api_not_configured',
          message: 'API not configured',
          details: 'Please add your Claude API key to .env.local',
          isRetryable: false,
        },
        isApiConfigured: false,
      });
      return error;
    }

    set({
      isExtracting: true,
      extractionError: null,
      extractionConfidence: null,
      extractionWarnings: [],
    });

    try {
      const result = await extractSchemaFromImage(imageBase64, mediaType);

      if (result.success) {
        // Increment import count
        const newCount = importsThisMonth + 1;
        const importData: ImportData = {
          count: newCount,
          monthYear: getCurrentMonthYear(),
        };
        await saveImportData(importData);

        set({
          extractedSchema: result.schema,
          extractionConfidence: result.confidence,
          extractionWarnings: result.warnings || [],
          isExtracting: false,
          importsThisMonth: newCount,
          canImport: newCount < FREE_TIER_MONTHLY_LIMIT,
        });
      } else {
        const categorizedError = categorizeError(result.error, result.details);
        set({
          extractionError: categorizedError,
          isExtracting: false,
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const categorizedError = categorizeError(message);
      set({
        extractionError: categorizedError,
        isExtracting: false,
      });
      return {
        success: false,
        error: 'Extraction failed',
        details: message,
      };
    }
  },

  clearExtractedSchema: () =>
    set({
      extractedSchema: null,
      extractionConfidence: null,
      extractionWarnings: [],
    }),

  clearError: () => set({ extractionError: null }),

  // Load import count from storage
  loadImportCount: async () => {
    const data = await loadStoredImportData();
    const currentMonth = getCurrentMonthYear();
    const { isPremium } = get();

    // Reset count if it's a new month
    if (data.monthYear !== currentMonth) {
      const newData: ImportData = { count: 0, monthYear: currentMonth };
      await saveImportData(newData);
      set({
        importsThisMonth: 0,
        canImport: true,
      });
    } else {
      set({
        importsThisMonth: data.count,
        canImport: isPremium || data.count < FREE_TIER_MONTHLY_LIMIT,
      });
    }
  },

  // Check if user can still import
  checkCanImport: () => {
    const { importsThisMonth, monthlyLimit, isPremium } = get();
    // Premium users have unlimited imports
    if (isPremium) return true;
    return importsThisMonth < monthlyLimit;
  },

  // Update premium status (called from subscription context)
  setPremiumStatus: (isPremium: boolean) => {
    const { importsThisMonth } = get();
    set({
      isPremium,
      monthlyLimit: isPremium ? UNLIMITED_IMPORTS : FREE_TIER_MONTHLY_LIMIT,
      canImport: isPremium || importsThisMonth < FREE_TIER_MONTHLY_LIMIT,
    });
  },

  // Check API configuration
  checkApiConfiguration: () => {
    const configured = isApiKeyConfigured();
    set({ isApiConfigured: configured });
  },
}));
