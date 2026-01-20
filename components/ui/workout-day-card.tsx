import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { WorkoutDayWithExercises } from '@/db/types';
import { formatRelativeDate } from '@/utils/format';

export type WorkoutDayCardProps = {
  day: WorkoutDayWithExercises;
  schemaName: string;
  lastWorkoutDate?: number | null;
  onPress?: () => void;
};

export const WorkoutDayCard = memo(function WorkoutDayCard({
  day,
  schemaName,
  lastWorkoutDate,
  onPress,
}: WorkoutDayCardProps) {
  const exerciseCount = day.exercises.length;

  // Memoize formatted date to prevent recalculation
  const formattedLastWorkout = useMemo(
    () => (lastWorkoutDate ? formatRelativeDate(lastWorkoutDate) : null),
    [lastWorkoutDate]
  );

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

        {formattedLastWorkout && (
          <View style={styles.detailItem}>
            <IconSymbol
              name="clock"
              size={14}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.detailText}>
              {formattedLastWorkout}
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
});

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
