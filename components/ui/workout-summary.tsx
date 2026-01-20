import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import type { WorkoutSummaryData } from '@/stores/workout-store';

export type { WorkoutSummaryData };

interface WorkoutSummaryProps {
  data: WorkoutSummaryData;
  onDone: () => void;
}

export function WorkoutSummary({ data, onDone }: WorkoutSummaryProps) {
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const hasProgressions = data.progressionsEarned.length > 0;

  return (
    <View style={styles.container}>
      {/* Success Icon */}
      <View style={styles.iconContainer}>
        <IconSymbol
          name="checkmark.circle.fill"
          size={64}
          color="#22C55E"
        />
      </View>

      {/* Title */}
      <ThemedText style={styles.title}>Workout Complete!</ThemedText>
      <ThemedText style={styles.subtitle}>
        Great job finishing your session
      </ThemedText>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <IconSymbol name="timer" size={24} color={Colors.dark.primary} />
          <ThemedText style={styles.statValue}>
            {formatDuration(data.duration)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Duration</ThemedText>
        </Card>

        <Card style={styles.statCard}>
          <IconSymbol name="checkmark.circle" size={24} color="#22C55E" />
          <ThemedText style={styles.statValue}>
            {data.completedExercises}/{data.totalExercises}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Completed</ThemedText>
        </Card>

        <Card style={styles.statCard}>
          <IconSymbol name="number" size={24} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.statValue}>{data.totalSetsCompleted}</ThemedText>
          <ThemedText style={styles.statLabel}>Sets</ThemedText>
        </Card>

        <Card style={styles.statCard}>
          <IconSymbol name="flame.fill" size={24} color="#F59E0B" />
          <ThemedText style={styles.statValue}>{data.totalReps}</ThemedText>
          <ThemedText style={styles.statLabel}>Reps</ThemedText>
        </Card>
      </View>

      {/* Progressions Earned */}
      {hasProgressions && (
        <Card style={styles.progressionCard}>
          <View style={styles.progressionHeader}>
            <IconSymbol name="arrow.up.circle.fill" size={24} color="#22C55E" />
            <ThemedText style={styles.progressionTitle}>
              Progressions Earned
            </ThemedText>
          </View>
          <View style={styles.progressionList}>
            {data.progressionsEarned.map((progression, index) => (
              <View key={index} style={styles.progressionItem}>
                <ThemedText style={styles.progressionExercise}>
                  {progression.exerciseName}
                </ThemedText>
                <ThemedText style={styles.progressionWeight}>
                  {progression.oldWeight}kg → {progression.newWeight}kg
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Skipped Notice */}
      {data.skippedExercises > 0 && (
        <View style={styles.skippedNotice}>
          <IconSymbol name="forward.fill" size={16} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.skippedText}>
            {data.skippedExercises} exercise{data.skippedExercises > 1 ? 's' : ''} skipped
          </ThemedText>
        </View>
      )}

      {/* Done Button */}
      <View style={styles.doneButton}>
        <Button
          title="Done"
          onPress={onDone}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 32,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  progressionCard: {
    width: '100%',
    marginBottom: 16,
  },
  progressionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  progressionList: {
    gap: 8,
  },
  progressionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  progressionExercise: {
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
  },
  progressionWeight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22C55E',
  },
  skippedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  skippedText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  doneButton: {
    marginTop: 'auto',
    width: '100%',
  },
});
