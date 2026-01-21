import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View, ListRenderItem } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutDayCard } from '@/components/ui/workout-day-card';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/stores/schema-store';
import { useWorkoutStore } from '@/stores/workout-store';
import { Colors } from '@/constants/theme';
import { SchemaWithDays, WorkoutDayWithExercises, WorkoutSession } from '@/db/types';
import { api } from '@/convex/_generated/api';
import * as db from '@/db/database';

interface WorkoutDayWithSchema {
  day: WorkoutDayWithExercises;
  schema: SchemaWithDays;
  lastWorkout: WorkoutSession | null;
}

export default function HomeScreen() {
  const router = useRouter();
  // Use selectors to prevent unnecessary re-renders when unrelated state changes
  const loadSchemas = useSchemaStore((state) => state.loadSchemas);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const resumeWorkout = useWorkoutStore((state) => state.resumeWorkout);
  const session = useWorkoutStore((state) => state.session);

  // Trainer queries
  const trainer = useQuery(api.trainers.currentTrainer);
  const clientCount = useQuery(api.trainers.getClientCount);
  const clients = useQuery(api.trainers.getClientsWithActivity, {});

  const [workoutDays, setWorkoutDays] = useState<WorkoutDayWithSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkoutDays = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load all schemas with their days and last workouts using batch query
      await loadSchemas();
      const schemasWithLastWorkouts = await db.getSchemasWithDaysAndLastWorkout();

      const days: WorkoutDayWithSchema[] = [];

      for (const { schema, lastWorkouts } of schemasWithLastWorkouts) {
        for (const day of schema.days) {
          days.push({
            day,
            schema,
            lastWorkout: lastWorkouts.get(day.id) ?? null,
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

  const handleDayPress = useCallback(async (item: WorkoutDayWithSchema) => {
    try {
      await startWorkout(item.day, item.schema.id);
      router.push(`/workout/${item.day.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    }
  }, [startWorkout, router]);

  const handleResumeWorkout = useCallback(async () => {
    const hasActiveSession = await resumeWorkout();
    if (hasActiveSession) {
      const activeSession = useWorkoutStore.getState().session;
      if (activeSession) {
        router.push(`/workout/${activeSession.dayId}`);
      }
    }
  }, [resumeWorkout, router]);

  const handleCreateSchema = useCallback(() => {
    router.push('/(tabs)/(schemas)/create');
  }, [router]);

  const handleManageClients = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/(tabs)/(home)/clients');
  }, [router]);

  // Calculate client activity stats
  const clientStats = useMemo(() => {
    if (!clients) return null;

    const activeClients = clients.filter(c => c.status === 'active');
    const needsAttention = activeClients.filter(c => {
      if (!c.lastWorkout) return true;
      const daysSinceWorkout = Math.floor((Date.now() - c.lastWorkout) / (24 * 60 * 60 * 1000));
      return daysSinceWorkout > 7;
    });
    const recentlyActive = activeClients.filter(c => {
      if (!c.lastWorkout) return false;
      const daysSinceWorkout = Math.floor((Date.now() - c.lastWorkout) / (24 * 60 * 60 * 1000));
      return daysSinceWorkout <= 3;
    });

    return {
      total: activeClients.length,
      pending: clients.filter(c => c.status === 'invited').length,
      needsAttention: needsAttention.length,
      recentlyActive: recentlyActive.length,
    };
  }, [clients]);

  const keyExtractor = useCallback(
    (item: WorkoutDayWithSchema) => `${item.schema.id}-${item.day.id}`,
    []
  );

  const renderItem: ListRenderItem<WorkoutDayWithSchema> = useCallback(
    ({ item }) => (
      <WorkoutDayCard
        day={item.day}
        schemaName={item.schema.name}
        lastWorkoutDate={item.lastWorkout?.completedAt}
        onPress={() => handleDayPress(item)}
      />
    ),
    [handleDayPress]
  );

  const ListHeaderComponent = useMemo(
    () => (
      <>
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
              size="sm"
            />
          </View>
        )}

        {trainer && clientStats && (
          <Pressable
            onPress={handleManageClients}
            style={({ pressed }) => [
              styles.clientsCard,
              pressed && styles.clientsCardPressed,
            ]}
          >
            <View style={styles.clientsCardHeader}>
              <View style={styles.clientsCardIcon}>
                <MaterialIcons name="people" size={20} color={Colors.dark.primary} />
              </View>
              <View style={styles.clientsCardTitleContainer}>
                <ThemedText style={styles.clientsCardTitle}>My Clients</ThemedText>
                <ThemedText style={styles.clientsCardSubtitle}>
                  {clientStats.total} active · {clientCount?.maxClients ?? 0} max
                </ThemedText>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={Colors.dark.textSecondary}
              />
            </View>
            <View style={styles.clientsCardStats}>
              <View style={styles.clientStatItem}>
                <View style={[styles.clientStatDot, { backgroundColor: '#10B981' }]} />
                <ThemedText style={styles.clientStatValue}>{clientStats.recentlyActive}</ThemedText>
                <ThemedText style={styles.clientStatLabel}>active</ThemedText>
              </View>
              <View style={styles.clientStatDivider} />
              <View style={styles.clientStatItem}>
                <View style={[styles.clientStatDot, { backgroundColor: '#F59E0B' }]} />
                <ThemedText style={styles.clientStatValue}>{clientStats.pending}</ThemedText>
                <ThemedText style={styles.clientStatLabel}>pending</ThemedText>
              </View>
              {clientStats.needsAttention > 0 && (
                <>
                  <View style={styles.clientStatDivider} />
                  <View style={styles.clientStatItem}>
                    <View style={[styles.clientStatDot, { backgroundColor: '#EF4444' }]} />
                    <ThemedText style={styles.clientStatValue}>{clientStats.needsAttention}</ThemedText>
                    <ThemedText style={styles.clientStatLabel}>inactive</ThemedText>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        )}

        {workoutDays.length > 0 && (
          <ThemedText style={styles.sectionTitle}>Your Workouts</ThemedText>
        )}
      </>
    ),
    [error, session, handleResumeWorkout, trainer, clientStats, clientCount, handleManageClients, workoutDays.length]
  );

  const ListEmptyComponent = useMemo(
    () => (
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
    ),
    [handleCreateSchema]
  );

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
      <FlatList
        data={workoutDays}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        removeClippedSubviews={true}
        ItemSeparatorComponent={ItemSeparator}
      />
    </ThemedView>
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  separator: {
    height: 12,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clientsCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  clientsCardPressed: {
    opacity: 0.7,
  },
  clientsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientsCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientsCardTitleContainer: {
    flex: 1,
  },
  clientsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  clientsCardSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  clientsCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  clientStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clientStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  clientStatLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  clientStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 16,
  },
});
