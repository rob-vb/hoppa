import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/stores/schema-store';
import { Colors } from '@/constants/theme';

export default function SchemasScreen() {
  const router = useRouter();
  const { schemas, isLoading, error, loadSchemas } = useSchemaStore();

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  const handleSchemaPress = (schemaId: string) => {
    router.push(`/(tabs)/(schemas)/${schemaId}`);
  };

  const handleCreatePress = () => {
    router.push('/(tabs)/(schemas)/create');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
            <Button
              title="Create Schema"
              onPress={handleCreatePress}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {schemas.map((schema) => (
              <Card
                key={schema.id}
                onPress={() => handleSchemaPress(schema.id)}
                style={styles.schemaCard}
              >
                <View style={styles.schemaHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.schemaName}>
                    {schema.name}
                  </ThemedText>
                  {schema.progressiveLoadingEnabled && (
                    <View style={styles.progressionBadge}>
                      <ThemedText style={styles.progressionBadgeText}>
                        Progressive
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={styles.schemaDate}>
                  Updated {formatDate(schema.updatedAt)}
                </ThemedText>
              </Card>
            ))}
            <Button
              title="Create New Schema"
              variant="secondary"
              onPress={handleCreatePress}
              fullWidth
            />
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
  schemaCard: {
    gap: 8,
  },
  schemaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  schemaName: {
    fontSize: 18,
    flex: 1,
  },
  progressionBadge: {
    backgroundColor: Colors.dark.primary + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressionBadgeText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  schemaDate: {
    fontSize: 14,
    opacity: 0.6,
  },
});
