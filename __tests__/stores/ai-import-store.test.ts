import { act } from 'react';
import { useAIImportStore } from '@/stores/ai-import-store';
import * as SecureStore from 'expo-secure-store';
import * as claudeApi from '@/services/claude-api';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

// Mock claude-api
jest.mock('@/services/claude-api', () => ({
  extractSchemaFromImage: jest.fn(),
  isApiKeyConfigured: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedClaudeApi = claudeApi as jest.Mocked<typeof claudeApi>;

// Constants matching the store
const FREE_TIER_MONTHLY_LIMIT = 3;
const STORAGE_KEY_IMPORT_DATA = 'ai_import_data';

// Helper to get current month-year string
function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

describe('ai-import-store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAIImportStore.setState({
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
    });
    // Clear all mocks
    jest.clearAllMocks();
    // Default API configured
    mockedClaudeApi.isApiKeyConfigured.mockReturnValue(true);
  });

  describe('loadImportCount', () => {
    it('should load import count from storage', async () => {
      const importData = { count: 2, monthYear: getCurrentMonthYear() };
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(importData));

      await act(async () => {
        await useAIImportStore.getState().loadImportCount();
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(2);
      expect(useAIImportStore.getState().canImport).toBe(true);
    });

    it('should reset count when month changes', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthYear = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const importData = { count: 3, monthYear: lastMonthYear };
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(importData));

      await act(async () => {
        await useAIImportStore.getState().loadImportCount();
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(0);
      expect(useAIImportStore.getState().canImport).toBe(true);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEY_IMPORT_DATA,
        expect.stringContaining(getCurrentMonthYear())
      );
    });

    it('should initialize to 0 when no stored data', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      await act(async () => {
        await useAIImportStore.getState().loadImportCount();
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(0);
      expect(useAIImportStore.getState().canImport).toBe(true);
    });

    it('should set canImport to false when at limit for free users', async () => {
      const importData = { count: 3, monthYear: getCurrentMonthYear() };
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(importData));

      await act(async () => {
        await useAIImportStore.getState().loadImportCount();
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(3);
      expect(useAIImportStore.getState().canImport).toBe(false);
    });

    it('should allow imports for premium users even at limit', async () => {
      useAIImportStore.setState({ isPremium: true });
      const importData = { count: 10, monthYear: getCurrentMonthYear() };
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(importData));

      await act(async () => {
        await useAIImportStore.getState().loadImportCount();
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(10);
      expect(useAIImportStore.getState().canImport).toBe(true);
    });
  });

  describe('checkCanImport', () => {
    it('should return true for free user under limit', () => {
      useAIImportStore.setState({
        isPremium: false,
        importsThisMonth: 2,
        monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
      });

      const canImport = useAIImportStore.getState().checkCanImport();

      expect(canImport).toBe(true);
    });

    it('should return false for free user at limit', () => {
      useAIImportStore.setState({
        isPremium: false,
        importsThisMonth: 3,
        monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
      });

      const canImport = useAIImportStore.getState().checkCanImport();

      expect(canImport).toBe(false);
    });

    it('should always return true for premium users', () => {
      useAIImportStore.setState({
        isPremium: true,
        importsThisMonth: 100,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
      });

      const canImport = useAIImportStore.getState().checkCanImport();

      expect(canImport).toBe(true);
    });
  });

  describe('setPremiumStatus', () => {
    it('should update premium status and limits', () => {
      act(() => {
        useAIImportStore.getState().setPremiumStatus(true);
      });

      expect(useAIImportStore.getState().isPremium).toBe(true);
      expect(useAIImportStore.getState().monthlyLimit).toBe(Number.MAX_SAFE_INTEGER);
      expect(useAIImportStore.getState().canImport).toBe(true);
    });

    it('should restore free tier limits when downgrading', () => {
      useAIImportStore.setState({
        isPremium: true,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
        importsThisMonth: 5,
      });

      act(() => {
        useAIImportStore.getState().setPremiumStatus(false);
      });

      expect(useAIImportStore.getState().isPremium).toBe(false);
      expect(useAIImportStore.getState().monthlyLimit).toBe(FREE_TIER_MONTHLY_LIMIT);
      expect(useAIImportStore.getState().canImport).toBe(false); // 5 > 3
    });

    it('should allow imports after downgrade if under limit', () => {
      useAIImportStore.setState({
        isPremium: true,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
        importsThisMonth: 2,
      });

      act(() => {
        useAIImportStore.getState().setPremiumStatus(false);
      });

      expect(useAIImportStore.getState().canImport).toBe(true); // 2 < 3
    });
  });

  describe('extractSchema', () => {
    it('should successfully extract schema and increment count', async () => {
      const mockResponse = {
        success: true as const,
        schema: {
          name: 'Test Workout',
          days: [],
        },
        confidence: 'high' as const,
        warnings: [],
      };
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue(mockResponse);

      let result: any;
      await act(async () => {
        result = await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(result.success).toBe(true);
      expect(useAIImportStore.getState().extractedSchema).toEqual(mockResponse.schema);
      expect(useAIImportStore.getState().importsThisMonth).toBe(1);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should reject when rate limit reached', async () => {
      useAIImportStore.setState({
        isPremium: false,
        importsThisMonth: 3,
        monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
        canImport: false,
      });

      let result: any;
      await act(async () => {
        result = await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Monthly import limit reached');
      expect(useAIImportStore.getState().extractionError?.type).toBe('rate_limit');
      expect(mockedClaudeApi.extractSchemaFromImage).not.toHaveBeenCalled();
    });

    it('should reject when API is not configured', async () => {
      mockedClaudeApi.isApiKeyConfigured.mockReturnValue(false);

      let result: any;
      await act(async () => {
        result = await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API not configured');
      expect(useAIImportStore.getState().extractionError?.type).toBe(
        'api_not_configured'
      );
    });

    it('should set loading state during extraction', async () => {
      let loadingDuringExtraction = false;
      mockedClaudeApi.extractSchemaFromImage.mockImplementation(async () => {
        loadingDuringExtraction = useAIImportStore.getState().isExtracting;
        return {
          success: true as const,
          schema: { name: 'Test', days: [] },
          confidence: 'high' as const,
        };
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(loadingDuringExtraction).toBe(true);
      expect(useAIImportStore.getState().isExtracting).toBe(false);
    });

    it('should handle API errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: false,
        error: 'API error',
        details: 'Server returned 500',
      });

      let result: any;
      await act(async () => {
        result = await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(result.success).toBe(false);
      expect(useAIImportStore.getState().extractionError?.type).toBe('api_error');
      expect(useAIImportStore.getState().importsThisMonth).toBe(0); // Not incremented
    });

    it('should handle network errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockRejectedValue(
        new Error('Network error')
      );

      let result: any;
      await act(async () => {
        result = await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(result.success).toBe(false);
      expect(useAIImportStore.getState().extractionError?.type).toBe('network');
    });

    it('should store extraction confidence and warnings', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: true as const,
        schema: { name: 'Test', days: [] },
        confidence: 'medium' as const,
        warnings: ['Some text was unclear', 'Weight units assumed to be kg'],
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().extractionConfidence).toBe('medium');
      expect(useAIImportStore.getState().extractionWarnings).toEqual([
        'Some text was unclear',
        'Weight units assumed to be kg',
      ]);
    });

    it('should update canImport when reaching limit', async () => {
      useAIImportStore.setState({
        isPremium: false,
        importsThisMonth: 2,
        monthlyLimit: FREE_TIER_MONTHLY_LIMIT,
        canImport: true,
      });

      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: true as const,
        schema: { name: 'Test', days: [] },
        confidence: 'high' as const,
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(3);
      expect(useAIImportStore.getState().canImport).toBe(false);
    });

    it('should allow unlimited imports for premium users via checkCanImport', async () => {
      useAIImportStore.setState({
        isPremium: true,
        importsThisMonth: 99,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
        canImport: true,
      });

      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: true as const,
        schema: { name: 'Test', days: [] },
        confidence: 'high' as const,
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().importsThisMonth).toBe(100);
      // Note: The canImport state is set based on FREE_TIER_MONTHLY_LIMIT in extractSchema,
      // but checkCanImport() method checks premium status
      expect(useAIImportStore.getState().checkCanImport()).toBe(true);
    });
  });

  describe('clearExtractedSchema', () => {
    it('should clear extracted schema and related state', () => {
      useAIImportStore.setState({
        extractedSchema: { name: 'Test', days: [] },
        extractionConfidence: 'high',
        extractionWarnings: ['Warning'],
      });

      act(() => {
        useAIImportStore.getState().clearExtractedSchema();
      });

      expect(useAIImportStore.getState().extractedSchema).toBe(null);
      expect(useAIImportStore.getState().extractionConfidence).toBe(null);
      expect(useAIImportStore.getState().extractionWarnings).toEqual([]);
    });
  });

  describe('clearError', () => {
    it('should clear extraction error', () => {
      useAIImportStore.setState({
        extractionError: {
          type: 'network',
          message: 'Network error',
          details: 'Details',
          isRetryable: true,
        },
      });

      act(() => {
        useAIImportStore.getState().clearError();
      });

      expect(useAIImportStore.getState().extractionError).toBe(null);
    });
  });

  describe('checkApiConfiguration', () => {
    it('should update isApiConfigured based on API key presence', () => {
      mockedClaudeApi.isApiKeyConfigured.mockReturnValue(true);

      act(() => {
        useAIImportStore.getState().checkApiConfiguration();
      });

      expect(useAIImportStore.getState().isApiConfigured).toBe(true);
    });

    it('should set isApiConfigured to false when not configured', () => {
      mockedClaudeApi.isApiKeyConfigured.mockReturnValue(false);

      act(() => {
        useAIImportStore.getState().checkApiConfiguration();
      });

      expect(useAIImportStore.getState().isApiConfigured).toBe(false);
    });
  });

  describe('error categorization', () => {
    it('should categorize blurry image errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: false,
        error: 'Image is too blurry to read',
        details: 'Please take a clearer photo',
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().extractionError?.type).toBe('unclear_image');
      expect(useAIImportStore.getState().extractionError?.isRetryable).toBe(true);
    });

    it('should categorize no workout detected errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: false,
        error: 'No workout plan found in image',
        details: 'Could not identify any exercises',
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().extractionError?.type).toBe(
        'no_workout_detected'
      );
    });

    it('should categorize parse errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: false,
        error: 'Invalid JSON format returned',
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().extractionError?.type).toBe('parse_error');
    });

    it('should categorize unknown errors', async () => {
      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: false,
        error: 'Something unexpected happened',
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      expect(useAIImportStore.getState().extractionError?.type).toBe('unknown');
    });
  });

  describe('premium subscription integration', () => {
    it('should still track import count for premium users', async () => {
      useAIImportStore.setState({
        isPremium: true,
        importsThisMonth: 5,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
      });

      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: true as const,
        schema: { name: 'Test', days: [] },
        confidence: 'high' as const,
      });

      await act(async () => {
        await useAIImportStore
          .getState()
          .extractSchema('base64image', 'image/jpeg');
      });

      // Count increments for tracking
      expect(useAIImportStore.getState().importsThisMonth).toBe(6);
      // checkCanImport() checks premium status for actual enforcement
      expect(useAIImportStore.getState().checkCanImport()).toBe(true);
    });

    it('should track imports separately from limit enforcement for premium', async () => {
      useAIImportStore.setState({
        isPremium: true,
        importsThisMonth: 0,
        monthlyLimit: Number.MAX_SAFE_INTEGER,
      });

      mockedClaudeApi.extractSchemaFromImage.mockResolvedValue({
        success: true as const,
        schema: { name: 'Test', days: [] },
        confidence: 'high' as const,
      });

      // Run 5 imports
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await useAIImportStore
            .getState()
            .extractSchema('base64image', 'image/jpeg');
        });
      }

      expect(useAIImportStore.getState().importsThisMonth).toBe(5);
      // checkCanImport() should return true for premium users regardless of count
      expect(useAIImportStore.getState().checkCanImport()).toBe(true);
    });
  });
});
