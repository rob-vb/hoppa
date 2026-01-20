import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutDayCard } from '@/components/ui/workout-day-card';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/stores/schema-store';
import { useWorkoutStore } from '@/stores/workout-store';
import { Colors } from '@/constants/theme';
import { SchemaWithDays, WorkoutDayWithExercises, WorkoutSession } from '@/db/types';
import * as db from '@/db/database';

interface WorkoutDayWithSchema {
  day: WorkoutDayWithExercises;
  schema: SchemaWithDays;
  lastWorkout: WorkoutSession | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { loadSchemas } = useSchemaStore();
  const { startWorkout, resumeWorkout, session } = useWorkoutStore();

  const [workoutDays, setWorkoutDays] = useState<WorkoutDayWithSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkoutDays = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load all schemas with their days
      await loadSchemas();
      const allSchemas = useSchemaStore.getState().schemas;

      const days: WorkoutDayWithSchema[] = [];

      for (const schema of allSchemas) {
        const schemaWithDays = await db.getSchemaWithDays(schema.id);
        if (!schemaWithDays) continue;

        for (const day of schemaWithDays.days) {
          const lastWorkout = await db.getLastWorkoutForDay(day.id);
          days.push({
            day,
            schema: schemaWithDays,
            lastWorkout,
          });
        }
      }

      // Sort by last workout date (most recent first), days without workouts at the end
      days.sort((a, b) => {
        if (!a.lastWorkout && !b.lastWorkout) return 0;
        if (!a.lastWorkout) return 1;
        if (!b.lastWorkout) return -1;
        return (b.lastWorkout.completedAt ?? 0) - (a.lastWorkout.completedAt ?? 0);
      });

      setWorkoutDays(days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout days');
    } finally {
      setIsLoading(false);
    }
  }, [loadSchemas]);

  // Load data on mount
  useEffect(() => {
    loadWorkoutDays();
  }, [loadWorkoutDays]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWorkoutDays();
    }, [loadWorkoutDays])
  );

  const handleDayPress = async (item: WorkoutDayWithSchema) => {
    try {
      await startWorkout(item.day, item.schema.id);
      router.push(`/workout/${item.day.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    }
  };

  const handleResumeWorkout = async () => {
    const hasActiveSession = await resumeWorkout();
    if (hasActiveSession) {
      const activeSession = useWorkoutStore.getState().session;
      if (activeSession) {
        router.push(`/workout/${activeSession.dayId}`);
      }
    }
  };

  const handleCreateSchema = () => {
    router.push('/(tabs)/(schemas)/create');
  };

  if (isLoading && workoutDays.length === 0) {
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

        {session && (
          <View style={styles.activeSessionBanner}>
            <View style={styles.activeSessionContent}>
              <View style={styles.activeSessionDot} />
              <ThemedText style={styles.activeSessionText}>
                Workout in progress
              </ThemedText>
            </View>
            <Button
              title="Resume"
              onPress={handleResumeWorkout}
              size="small"
            />
          </View>
        )}

        {workoutDays.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.placeholder}>
              <ThemedText style={styles.placeholderText}>
                No workout days yet
              </ThemedText>
              <ThemedText style={styles.placeholderSubtext}>
                Create a schema with workout days to get started
              </ThemedText>
            </View>
            <Button
              title="Create Schema"
              onPress={handleCreateSchema}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            <ThemedText style={styles.sectionTitle}>Your Workouts</ThemedText>
            {workoutDays.map((item) => (
              <WorkoutDayCard
                key={`${item.schema.id}-${item.day.id}`}
                day={item.day}
                schemaName={item.schema.name}
                lastWorkoutDate={item.lastWorkout?.completedAt}
                onPress={() => handleDayPress(item)}
              />
            ))}
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
  activeSessionBanner: {
    backgroundColor: Colors.dark.primary + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeSessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeSessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  activeSessionText: {
    color: Colors.dark.primary,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
