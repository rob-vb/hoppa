import { useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SchemaCard } from '@/components/ui/schema-card';
import { useSchemaStore } from '@/stores/schema-store';
import { usePremium, FREE_TIER_SCHEMA_LIMIT } from '@/hooks/use-premium';
import { Colors } from '@/constants/theme';

export default function SchemasScreen() {
  const router = useRouter();
  const { schemas, isLoading, error, loadSchemas } = useSchemaStore();
  const { isPremium, canCreateSchema, schemasRemaining, showPaywall } = usePremium();

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  const handleSchemaPress = (schemaId: string) => {
    router.push(`/(tabs)/(schemas)/${schemaId}`);
  };

  const handleCreatePress = () => {
    if (!canCreateSchema) {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Schema Limit Reached',
          `Free accounts can create up to ${FREE_TIER_SCHEMA_LIMIT} schemas. Upgrade to Premium for unlimited schemas.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: showPaywall },
          ]
        );
      }
      return;
    }
    router.push('/(tabs)/(schemas)/create');
  };

  const handleAIImportPress = () => {
    if (!canCreateSchema) {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Schema Limit Reached',
          `Free accounts can create up to ${FREE_TIER_SCHEMA_LIMIT} schemas. Upgrade to Premium for unlimited schemas.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: showPaywall },
          ]
        );
      }
      return;
    }
    router.push('/(tabs)/(schemas)/ai-import');
  };

  if (isLoading && schemas.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {!isPremium && schemas.length > 0 && (
          <Card style={styles.limitBanner}>
            <View style={styles.limitBannerContent}>
              <View style={styles.limitBannerText}>
                <ThemedText style={styles.limitBannerTitle}>
                  {canCreateSchema
                    ? `${schemasRemaining} schema${schemasRemaining === 1 ? '' : 's'} remaining`
                    : 'Schema limit reached'}
                </ThemedText>
                <ThemedText style={styles.limitBannerSubtitle}>
                  {canCreateSchema
                    ? 'Upgrade to Premium for unlimited schemas'
                    : 'Upgrade to create more schemas'}
                </ThemedText>
              </View>
              <Button
                title="Upgrade"
                size="sm"
                onPress={showPaywall}
              />
            </View>
          </Card>
        )}

        {schemas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.placeholder}>
              <ThemedText style={styles.placeholderText}>
                No workout schemas yet
              </ThemedText>
              <ThemedText style={styles.placeholderSubtext}>
                Create your first schema to get started
              </ThemedText>
            </View>
            <View style={styles.buttonGroup}>
              <Button
                title="Create Schema"
                onPress={handleCreatePress}
                fullWidth
              />
              <Button
                title="Import with AI"
                variant="secondary"
                onPress={handleAIImportPress}
                fullWidth
              />
            </View>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {schemas.map((schema) => (
              <SchemaCard
                key={schema.id}
                schema={schema}
                onPress={() => handleSchemaPress(schema.id)}
              />
            ))}
            <View style={styles.buttonGroup}>
              <Button
                title="Create New Schema"
                variant="secondary"
                onPress={handleCreatePress}
                fullWidth
              />
              <Button
                title="Import with AI"
                variant="secondary"
                onPress={handleAIImportPress}
                fullWidth
              />
            </View>
          </View>
        )}
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
  },
  limitBanner: {
    marginBottom: 16,
  },
  limitBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  limitBannerText: {
    flex: 1,
  },
  limitBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  limitBannerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    gap: 16,
  },
  placeholder: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  placeholderText: {
    opacity: 0.7,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  placeholderSubtext: {
    opacity: 0.5,
    textAlign: 'center',
  },
  listContainer: {
    gap: 12,
  },
  buttonGroup: {
    gap: 12,
  },
});
