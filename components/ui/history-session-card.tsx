import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { WorkoutSession } from '@/db/types';
import { formatRelativeDate, formatTimeOfDay, formatDuration } from '@/utils/format';

export type HistorySessionCardProps = {
  session: WorkoutSession;
  dayName: string;
  schemaName: string;
  exerciseCount: number;
  completedCount: number;
  totalReps: number;
  progressionCount: number;
  onPress?: () => void;
};

export const HistorySessionCard = memo(function HistorySessionCard({
  session,
  dayName,
  schemaName,
  exerciseCount,
  completedCount,
  totalReps,
  progressionCount,
  onPress,
}: HistorySessionCardProps) {
  const completedAt = session.completedAt ?? session.startedAt;
  const allCompleted = completedCount === exerciseCount;

  // Memoize formatted values to prevent recalculation on re-renders
  const formattedDate = useMemo(() => formatRelativeDate(completedAt), [completedAt]);
  const formattedTime = useMemo(() => formatTimeOfDay(completedAt), [completedAt]);
  const duration = useMemo(
    () => formatDuration(completedAt - session.startedAt),
    [completedAt, session.startedAt]
  );

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <ThemedText type="defaultSemiBold" style={styles.date}>
            {formattedDate}
          </ThemedText>
          <ThemedText style={styles.time}>{formattedTime}</ThemedText>
        </View>
        <View style={styles.titleRow}>
          <ThemedText type="defaultSemiBold" style={styles.dayName}>
            {dayName}
          </ThemedText>
          <IconSymbol
            name="chevron.right"
            size={16}
            color={Colors.dark.textSecondary}
          />
        </View>
        <ThemedText style={styles.schemaName}>{schemaName}</ThemedText>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <IconSymbol
            name="timer"
            size={14}
            color={Colors.dark.textSecondary}
          />
          <ThemedText style={styles.statText}>{duration}</ThemedText>
        </View>

        <View style={styles.statItem}>
          <IconSymbol
            name={allCompleted ? 'checkmark.circle.fill' : 'checkmark.circle'}
            size={14}
            color={allCompleted ? Colors.dark.primary : Colors.dark.textSecondary}
          />
          <ThemedText
            style={[styles.statText, allCompleted && styles.statTextHighlight]}
          >
            {completedCount}/{exerciseCount} exercises
          </ThemedText>
        </View>

        {totalReps > 0 && (
          <View style={styles.statItem}>
            <IconSymbol
              name="flame.fill"
              size={14}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.statText}>{totalReps} reps</ThemedText>
          </View>
        )}

        {progressionCount > 0 && (
          <View style={styles.statItem}>
            <IconSymbol
              name="arrow.up.circle.fill"
              size={14}
              color="#22C55E"
            />
            <ThemedText style={styles.statTextProgression}>
              {progressionCount} {progressionCount === 1 ? 'progression' : 'progressions'}
            </ThemedText>
          </View>
        )}
      </View>
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    color: Colors.dark.primary,
  },
  time: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
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
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  statTextHighlight: {
    color: Colors.dark.primary,
  },
  statTextProgression: {
    fontSize: 13,
    color: '#22C55E',
  },
});
