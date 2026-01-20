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
const STORAGE_KEY_IMPORT_DATA = 'ai_import_data';

interface ImportData {
  count: number;
  monthYear: string; // Format: "2024-01"
}

interface AIImportState {
  // Extraction state
  extractedSchema: ExtractedSchema | null;
  extractionError: string | null;
  isExtracting: boolean;

  // Rate limiting
  importsThisMonth: number;
  monthlyLimit: number;
  canImport: boolean;

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

export const useAIImportStore = create<AIImportStore>((set, get) => ({
  // Initial state
  extractedSchema: null,
  extractionError: null,
  isExtracting: false,
  importsThisMonth: 0,
  monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
  canImport: true,
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
      set({ extractionError: error.error });
      return error;
    }

    // Check API configuration
    if (!isApiKeyConfigured()) {
      const error: SchemaExtractionResponse = {
        success: false,
        error: 'API not configured',
        details: 'Please add your Claude API key to .env.local',
      };
      set({ extractionError: error.error, isApiConfigured: false });
      return error;
    }

    set({ isExtracting: true, extractionError: null });

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
          isExtracting: false,
          importsThisMonth: newCount,
          canImport: newCount < FREE_TIER_MONTHLY_LIMIT,
        });
      } else {
        set({
          extractionError: result.error,
          isExtracting: false,
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({
        extractionError: message,
        isExtracting: false,
      });
      return {
        success: false,
        error: 'Extraction failed',
        details: message,
      };
    }
  },

  clearExtractedSchema: () => set({ extractedSchema: null }),

  clearError: () => set({ extractionError: null }),

  // Load import count from storage
  loadImportCount: async () => {
    const data = await loadStoredImportData();
    const currentMonth = getCurrentMonthYear();

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
        canImport: data.count < FREE_TIER_MONTHLY_LIMIT,
      });
    }
  },

  // Check if user can still import
  checkCanImport: () => {
    const { importsThisMonth, monthlyLimit } = get();
    return importsThisMonth < monthlyLimit;
  },

  // Check API configuration
  checkApiConfiguration: () => {
    const configured = isApiKeyConfigured();
    set({ isApiConfigured: configured });
  },
}));
