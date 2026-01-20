import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { WorkoutSession } from '@/db/types';

export type HistorySessionCardProps = {
  session: WorkoutSession;
  dayName: string;
  schemaName: string;
  exerciseCount: number;
  completedCount: number;
  totalReps: number;
  onPress?: () => void;
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
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

export function HistorySessionCard({
  session,
  dayName,
  schemaName,
  exerciseCount,
  completedCount,
  totalReps,
  onPress,
}: HistorySessionCardProps) {
  const completedAt = session.completedAt ?? session.startedAt;
  const duration = formatDuration(session.startedAt, completedAt);
  const allCompleted = completedCount === exerciseCount;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <ThemedText type="defaultSemiBold" style={styles.date}>
            {formatDate(completedAt)}
          </ThemedText>
          <ThemedText style={styles.time}>{formatTime(completedAt)}</ThemedText>
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
      </View>
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
});
