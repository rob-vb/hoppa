import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';

export type WeightComparisonCardProps = {
  startingWeight: number;
  currentWeight: number;
  unit?: string;
};

export function WeightComparisonCard({
  startingWeight,
  currentWeight,
  unit = 'kg',
}: WeightComparisonCardProps) {
  const gain = currentWeight - startingWeight;
  const hasProgress = gain > 0;
  const percentageGain = startingWeight > 0 ? (gain / startingWeight) * 100 : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.container}>
        {/* Starting Weight */}
        <View style={styles.weightBlock}>
          <ThemedText style={styles.label}>Starting</ThemedText>
          <ThemedText style={styles.weight}>
            {startingWeight}
            <ThemedText style={styles.unit}>{unit}</ThemedText>
          </ThemedText>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <View style={styles.arrowLine} />
          <MaterialIcons
            name="arrow-forward"
            size={20}
            color={hasProgress ? '#10B981' : Colors.dark.textSecondary}
          />
        </View>

        {/* Current Weight */}
        <View style={styles.weightBlock}>
          <ThemedText style={styles.label}>Current</ThemedText>
          <ThemedText style={[styles.weight, hasProgress && styles.weightHighlight]}>
            {currentWeight}
            <ThemedText style={[styles.unit, hasProgress && styles.unitHighlight]}>
              {unit}
            </ThemedText>
          </ThemedText>
        </View>
      </View>

      {/* Gain Indicator */}
      <View style={styles.gainContainer}>
        {hasProgress ? (
          <>
            <MaterialIcons name="trending-up" size={16} color="#10B981" />
            <ThemedText style={styles.gainText}>
              +{gain.toFixed(1)}{unit} ({percentageGain.toFixed(0)}% increase)
            </ThemedText>
          </>
        ) : gain < 0 ? (
          <>
            <MaterialIcons name="trending-down" size={16} color="#EF4444" />
            <ThemedText style={[styles.gainText, styles.lossText]}>
              {gain.toFixed(1)}{unit} ({Math.abs(percentageGain).toFixed(0)}% decrease)
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.noChangeText}>No change yet</ThemedText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightBlock: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weight: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  weightHighlight: {
    color: '#10B981',
  },
  unit: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
  },
  unitHighlight: {
    color: '#10B981',
  },
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  arrowLine: {
    width: 20,
    height: 2,
    backgroundColor: Colors.dark.border,
    marginRight: -4,
  },
  gainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 6,
  },
  gainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  lossText: {
    color: '#EF4444',
  },
  noChangeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
});
