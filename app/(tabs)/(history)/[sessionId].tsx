import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Exercise, ExerciseLogWithSets, WorkoutSessionWithLogs } from '@/db/types';
import * as db from '@/db/database';

// Colors not in theme
const SUCCESS_COLOR = '#22C55E';
const WARNING_COLOR = '#F59E0B';

interface ExerciseLogWithDetails extends ExerciseLogWithSets {
  exercise: Exercise | null;
}

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<WorkoutSessionWithLogs | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogWithDetails[]>([]);
  const [dayName, setDayName] = useState<string>('');
  const [schemaName, setSchemaName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const sessionData = await db.getWorkoutSessionWithLogs(sessionId);
        if (!sessionData) {
          setError('Session not found');
          return;
        }

        setSession(sessionData);

        // Get schema and day names
        const schema = await db.getSchemaById(sessionData.schemaId);
        const day = await db.getWorkoutDayById(sessionData.dayId);
        setSchemaName(schema?.name ?? 'Unknown Schema');
        setDayName(day?.name ?? 'Unknown Day');

        // Get exercise details for each log
        const logsWithDetails: ExerciseLogWithDetails[] = await Promise.all(
          sessionData.exerciseLogs.map(async (log) => {
            const exercise = await db.getExerciseById(log.exerciseId);
            return { ...log, exercise };
          })
        );

        setExerciseLogs(logsWithDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </ThemedView>
    );
  }

  if (error || !session) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>{error ?? 'Session not found'}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const completedAt = session.completedAt ?? session.startedAt;
  const duration = formatDuration(session.startedAt, completedAt);
  const completedCount = exerciseLogs.filter((log) => log.status === 'completed').length;
  const totalReps = exerciseLogs.reduce(
    (sum, log) => sum + log.sets.reduce((setSum, set) => setSum + (set.completedReps ?? 0), 0),
    0
  );
  const progressionsEarned = exerciseLogs.filter((log) => log.progressionEarned).length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <ThemedText type="subtitle">{dayName}</ThemedText>
            <ThemedText style={styles.schemaName}>{schemaName}</ThemedText>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <IconSymbol name="timer" size={18} color={Colors.dark.primary} />
              <View>
                <ThemedText style={styles.statValue}>{duration}</ThemedText>
                <ThemedText style={styles.statLabel}>Duration</ThemedText>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconSymbol name="checkmark.circle.fill" size={18} color={Colors.dark.primary} />
              <View>
                <ThemedText style={styles.statValue}>
                  {completedCount}/{exerciseLogs.length}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Exercises</ThemedText>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconSymbol name="flame.fill" size={18} color={Colors.dark.primary} />
              <View>
                <ThemedText style={styles.statValue}>{totalReps}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Reps</ThemedText>
              </View>
            </View>

            {progressionsEarned > 0 && (
              <View style={styles.statItem}>
                <IconSymbol name="arrow.up.circle.fill" size={18} color={SUCCESS_COLOR} />
                <View>
                  <ThemedText style={[styles.statValue, styles.progressionValue]}>
                    {progressionsEarned}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Progressions</ThemedText>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Exercise Logs */}
        <View style={styles.exercisesSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Exercise Logs
          </ThemedText>

          {exerciseLogs.map((log) => (
            <ExerciseLogCard key={log.id} log={log} />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function ExerciseLogCard({ log }: { log: ExerciseLogWithDetails }) {
  const exerciseName = log.exercise?.name ?? 'Unknown Exercise';
  const isCompleted = log.status === 'completed';
  const isSkipped = log.status === 'skipped';

  const completedSets = log.sets.filter((set) => set.completedReps !== null).length;
  const totalSets = log.sets.length;
  const totalReps = log.sets.reduce((sum, set) => sum + (set.completedReps ?? 0), 0);

  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderLeft}>
          <View
            style={[
              styles.statusIndicator,
              isCompleted && styles.statusCompleted,
              isSkipped && styles.statusSkipped,
            ]}
          >
            <IconSymbol
              name={isCompleted ? 'checkmark' : isSkipped ? 'forward.fill' : 'ellipsis'}
              size={12}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.exerciseInfo}>
            <ThemedText type="defaultSemiBold" style={styles.exerciseName}>
              {exerciseName}
            </ThemedText>
            <ThemedText style={styles.exerciseMeta}>
              {log.totalWeight > 0 ? `${log.totalWeight} kg` : 'Bodyweight'}
              {log.progressionEarned && (
                <ThemedText style={styles.progressionBadge}> +Progression</ThemedText>
              )}
            </ThemedText>
          </View>
        </View>

        <View style={styles.exerciseHeaderRight}>
          <ThemedText style={styles.exerciseSummary}>
            {completedSets}/{totalSets} sets
          </ThemedText>
          <ThemedText style={styles.exerciseReps}>{totalReps} reps</ThemedText>
        </View>
      </View>

      {/* Sets breakdown */}
      <View style={styles.setsContainer}>
        {log.sets.map((set) => (
          <View key={set.id} style={styles.setRow}>
            <ThemedText style={styles.setNumber}>Set {set.setNumber}</ThemedText>
            <View style={styles.setDetails}>
              <ThemedText style={styles.targetReps}>Target: {set.targetReps}</ThemedText>
              <View style={styles.completedRepsContainer}>
                {set.completedReps !== null ? (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={14} color={SUCCESS_COLOR} />
                    <ThemedText style={styles.completedReps}>{set.completedReps} reps</ThemedText>
                  </>
                ) : (
                  <>
                    <IconSymbol name="minus.circle" size={14} color={Colors.dark.textSecondary} />
                    <ThemedText style={styles.notCompleted}>Not logged</ThemedText>
                  </>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function formatDuration(startedAt: number, completedAt: number): string {
  const durationMs = completedAt - startedAt;
  const minutes = Math.floor(durationMs / (1000 * 60));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
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
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
  },
  summaryCard: {
    gap: 16,
  },
  summaryHeader: {
    gap: 4,
  },
  schemaName: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  progressionValue: {
    color: SUCCESS_COLOR,
  },
  exercisesSection: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  exerciseCard: {
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCompleted: {
    backgroundColor: SUCCESS_COLOR,
  },
  statusSkipped: {
    backgroundColor: WARNING_COLOR,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
  },
  exerciseMeta: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  progressionBadge: {
    color: SUCCESS_COLOR,
    fontWeight: '600',
  },
  exerciseHeaderRight: {
    alignItems: 'flex-end',
  },
  exerciseSummary: {
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseReps: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  setsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 12,
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
    width: 50,
  },
  setDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetReps: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  completedRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedReps: {
    fontSize: 14,
    fontWeight: '500',
    color: SUCCESS_COLOR,
  },
  notCompleted: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
});
