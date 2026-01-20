import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { SchemaCard } from '@/components/ui/schema-card';
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
              <SchemaCard
                key={schema.id}
                schema={schema}
                onPress={() => handleSchemaPress(schema.id)}
              />
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
});
