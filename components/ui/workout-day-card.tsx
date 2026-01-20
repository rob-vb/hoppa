import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { WorkoutDayWithExercises } from '@/db/types';

export type WorkoutDayCardProps = {
  day: WorkoutDayWithExercises;
  schemaName: string;
  lastWorkoutDate?: number | null;
  onPress?: () => void;
};

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function WorkoutDayCard({
  day,
  schemaName,
  lastWorkoutDate,
  onPress,
}: WorkoutDayCardProps) {
  const exerciseCount = day.exercises.length;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText type="defaultSemiBold" style={styles.dayName}>
            {day.name}
          </ThemedText>
          <IconSymbol
            name="chevron.right"
            size={16}
            color={Colors.dark.textSecondary}
          />
        </View>
        <ThemedText style={styles.schemaName}>{schemaName}</ThemedText>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <IconSymbol
            name="dumbbell.fill"
            size={14}
            color={Colors.dark.textSecondary}
          />
          <ThemedText style={styles.detailText}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
          </ThemedText>
        </View>

        {lastWorkoutDate && (
          <View style={styles.detailItem}>
            <IconSymbol
              name="clock"
              size={14}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.detailText}>
              {formatRelativeDate(lastWorkoutDate)}
            </ThemedText>
          </View>
        )}
      </View>

      {exerciseCount > 0 && (
        <View style={styles.exercisePreview}>
          {day.exercises.slice(0, 3).map((exercise, index) => (
            <ThemedText key={exercise.id} style={styles.exerciseName}>
              {exercise.name}
              {index < Math.min(2, exerciseCount - 1) ? ', ' : ''}
            </ThemedText>
          ))}
          {exerciseCount > 3 && (
            <ThemedText style={styles.moreExercises}>
              +{exerciseCount - 3} more
            </ThemedText>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: 18,
    flex: 1,
  },
  schemaName: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  exercisePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 13,
    opacity: 0.7,
  },
  moreExercises: {
    fontSize: 13,
    color: Colors.dark.primary,
    marginLeft: 4,
  },
});
