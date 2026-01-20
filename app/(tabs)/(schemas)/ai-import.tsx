import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ImagePickerInput } from '@/components/ui/image-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAIImportStore } from '@/stores/ai-import-store';
import { Colors } from '@/constants/theme';
import type { ImagePickerResult } from '@/hooks/use-image-picker';
import type { ClaudeImageSource } from '@/services/claude-api';

export default function AIImportScreen() {
  const router = useRouter();
  const {
    extractSchema,
    isExtracting,
    extractionError,
    extractedSchema,
    importsThisMonth,
    monthlyLimit,
    canImport,
    isApiConfigured,
    loadImportCount,
    checkApiConfiguration,
    clearError,
  } = useAIImportStore();

  const [selectedImage, setSelectedImage] = useState<ImagePickerResult | null>(null);

  useEffect(() => {
    loadImportCount();
    checkApiConfiguration();
  }, [loadImportCount, checkApiConfiguration]);

  // Navigate to review screen when extraction is successful
  useEffect(() => {
    if (extractedSchema) {
      router.replace('/(tabs)/(schemas)/ai-review');
    }
  }, [extractedSchema, router]);

  const handleImageSelected = (image: ImagePickerResult | null) => {
    clearError();
    setSelectedImage(image);
  };

  const handleExtract = async () => {
    if (!selectedImage?.uri) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      // Read the image file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(selectedImage.uri, {
        encoding: 'base64',
      });

      // Determine media type from the image
      const mediaType = getMediaType(selectedImage.type);

      const result = await extractSchema(base64, mediaType);

      if (result.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Navigation happens via useEffect watching extractedSchema
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const getMediaType = (mimeType?: string): ClaudeImageSource['media_type'] => {
    switch (mimeType) {
      case 'image/png':
        return 'image/png';
      case 'image/gif':
        return 'image/gif';
      case 'image/webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  };

  const remainingImports = monthlyLimit - importsThisMonth;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <IconSymbol name="sparkles" size={32} color={Colors.dark.primary} />
          </View>
          <ThemedText type="subtitle" style={styles.title}>
            AI Schema Import
          </ThemedText>
          <ThemedText style={styles.description}>
            Take a photo or select an image of your workout plan. Our AI will extract
            the exercises and create a schema for you.
          </ThemedText>
        </View>

        {!isApiConfigured && (
          <Card style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <IconSymbol name="exclamationmark.triangle" size={20} color={Colors.dark.error} />
              <ThemedText style={styles.warningTitle}>API Not Configured</ThemedText>
            </View>
            <ThemedText style={styles.warningText}>
              Please add your Claude API key to the .env.local file to use AI import.
            </ThemedText>
          </Card>
        )}

        <Card style={styles.quotaCard}>
          <View style={styles.quotaRow}>
            <ThemedText style={styles.quotaLabel}>Monthly Imports</ThemedText>
            <ThemedText style={styles.quotaValue}>
              {importsThisMonth} / {monthlyLimit}
            </ThemedText>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(importsThisMonth / monthlyLimit) * 100}%` },
              ]}
            />
          </View>
          {!canImport && (
            <ThemedText style={styles.quotaWarning}>
              {"You've used all your imports for this month. Limit resets next month."}
            </ThemedText>
          )}
          {canImport && (
            <ThemedText style={styles.quotaHint}>
              {remainingImports} import{remainingImports !== 1 ? 's' : ''} remaining
            </ThemedText>
          )}
        </Card>

        <View style={styles.imageSection}>
          <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
            Workout Plan Image
          </ThemedText>
          <View style={styles.imagePickerContainer}>
            <ImagePickerInput
              value={selectedImage}
              onChange={handleImageSelected}
              placeholder="Add Photo"
              size={160}
              shape="rounded"
              showRemoveButton={true}
              allowsEditing={false}
              aspect={undefined}
              quality={0.8}
            />
          </View>
          {selectedImage && (
            <ThemedText style={styles.imageHint}>
              Tap the image to change it
            </ThemedText>
          )}
        </View>

        {extractionError && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{extractionError}</ThemedText>
          </View>
        )}

        {isExtracting && (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
            <ThemedText style={styles.loadingText}>
              Analyzing your workout plan...
            </ThemedText>
            <ThemedText style={styles.loadingHint}>
              This may take a few seconds
            </ThemedText>
          </Card>
        )}

        <View style={styles.bottomActions}>
          <Button
            title="Extract Schema"
            onPress={handleExtract}
            disabled={!selectedImage || isExtracting || !canImport || !isApiConfigured}
            loading={isExtracting}
            fullWidth
          />
        </View>

        <View style={styles.tipsSection}>
          <ThemedText type="defaultSemiBold" style={styles.tipsTitle}>
            Tips for Best Results
          </ThemedText>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <IconSymbol name="checkmark.circle" size={16} color={Colors.dark.primary} />
              <ThemedText style={styles.tipText}>
                Use good lighting and avoid shadows
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <IconSymbol name="checkmark.circle" size={16} color={Colors.dark.primary} />
              <ThemedText style={styles.tipText}>
                Make sure all text is readable
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <IconSymbol name="checkmark.circle" size={16} color={Colors.dark.primary} />
              <ThemedText style={styles.tipText}>
                Include exercise names, sets, and reps
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <IconSymbol name="checkmark.circle" size={16} color={Colors.dark.primary} />
              <ThemedText style={styles.tipText}>
                Handwritten notes, printed plans, and screenshots all work
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  warningCard: {
    marginBottom: 16,
    borderColor: Colors.dark.error,
    borderWidth: 1,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    color: Colors.dark.error,
    fontWeight: '600',
  },
  warningText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  quotaCard: {
    marginBottom: 24,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quotaLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  quotaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.dark.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
  },
  quotaWarning: {
    fontSize: 12,
    color: Colors.dark.error,
  },
  quotaHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  imagePickerContainer: {
    alignItems: 'center',
  },
  imageHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingHint: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  bottomActions: {
    marginBottom: 24,
  },
  tipsSection: {
    marginTop: 8,
  },
  tipsTitle: {
    marginBottom: 12,
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
});
