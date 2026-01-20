import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Exercise, SetLog, ExerciseLogStatus } from '@/db/types';

export type ExerciseCardProps = {
  exercise: Exercise;
  sets: SetLog[];
  totalWeight: number;
  status: ExerciseLogStatus;
  progressionEarned?: boolean;
  completedSetsCount: number;
};

export function ExerciseCard({
  exercise,
  sets,
  totalWeight,
  status,
  progressionEarned,
  completedSetsCount,
}: ExerciseCardProps) {
  const totalSets = sets.length;
  const isComplete = status === 'completed' || status === 'skipped';

  return (
    <Card style={styles.card}>
      {/* Exercise Name and Status */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.exerciseName}>
            {exercise.name}
          </ThemedText>
          {isComplete && (
            <View style={styles.statusBadge}>
              <IconSymbol
                name={status === 'skipped' ? 'forward.fill' : 'checkmark.circle.fill'}
                size={16}
                color={status === 'skipped' ? Colors.dark.textSecondary : '#22C55E'}
              />
            </View>
          )}
        </View>

        {/* Exercise Meta Info */}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <IconSymbol
              name="scalemass.fill"
              size={16}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.metaText}>{totalWeight} kg</ThemedText>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol
              name="arrow.trianglehead.2.clockwise"
              size={16}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.metaText}>
              {exercise.targetRepsMin}-{exercise.targetRepsMax} reps
            </ThemedText>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol
              name="square.stack.fill"
              size={16}
              color={Colors.dark.textSecondary}
            />
            <ThemedText style={styles.metaText}>
              {completedSetsCount}/{totalSets} sets
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(completedSetsCount / totalSets) * 100}%`,
                backgroundColor: isComplete
                  ? status === 'skipped'
                    ? Colors.dark.textSecondary
                    : '#22C55E'
                  : Colors.dark.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Progression Badge */}
      {isComplete && progressionEarned && (
        <View style={styles.progressionBadge}>
          <IconSymbol name="arrow.up.circle.fill" size={16} color="#22C55E" />
          <ThemedText style={styles.progressionText}>
            Progression earned! +{exercise.progressionIncrement}kg next time
          </ThemedText>
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
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: {
    fontSize: 22,
    flex: 1,
  },
  statusBadge: {
    marginLeft: 8,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  progressionText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
});
