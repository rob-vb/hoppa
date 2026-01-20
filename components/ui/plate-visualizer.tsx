import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import {
  PlateBreakdown,
  PlateResult,
  calculatePlates,
  formatWeight,
} from '@/utils/plate-calculator';

/** Color mapping for plate weights */
const PLATE_COLORS: Record<number, string> = {
  20: '#DC2626', // Red
  10: '#2563EB', // Blue
  5: '#FFFFFF', // White
  2.5: '#EF4444', // Light red
  1.25: '#FCD34D', // Yellow
  // Microplates
  1: '#A855F7', // Purple
  0.75: '#10B981', // Green
  0.5: '#06B6D4', // Cyan
  0.25: '#F97316', // Orange
};

/** Get plate width based on weight (heavier = wider) */
function getPlateWidth(weight: number): number {
  if (weight >= 20) return 16;
  if (weight >= 10) return 14;
  if (weight >= 5) return 12;
  if (weight >= 2.5) return 10;
  if (weight >= 1.25) return 8;
  return 6; // Microplates
}

/** Get plate height based on weight (heavier = taller) */
function getPlateHeight(weight: number): number {
  if (weight >= 20) return 64;
  if (weight >= 10) return 56;
  if (weight >= 5) return 48;
  if (weight >= 2.5) return 40;
  if (weight >= 1.25) return 32;
  return 24; // Microplates
}

export type PlateVisualizerProps = {
  /** Target weight to visualize */
  targetWeight: number;
  /** Base weight (bar/machine) in kg */
  baseWeight: number;
  /** Pre-calculated plate result (optional, will calculate if not provided) */
  plateResult?: PlateResult;
  /** Show the text breakdown below the visual */
  showBreakdown?: boolean;
  /** Compact mode with smaller dimensions */
  compact?: boolean;
};

export function PlateVisualizer({
  targetWeight,
  baseWeight,
  plateResult,
  showBreakdown = true,
  compact = false,
}: PlateVisualizerProps) {
  const result = plateResult ?? calculatePlates(targetWeight, baseWeight);
  const { platesPerSide } = result;

  // Check if any microplates are used
  const hasMicroplates = platesPerSide.some((p) => p.isMicroplate);

  // Flatten plates for rendering (respect count)
  const flatPlates: PlateBreakdown[] = [];
  for (const plate of platesPerSide) {
    for (let i = 0; i < plate.count; i++) {
      flatPlates.push({ ...plate, count: 1 });
    }
  }

  const scaleFactor = compact ? 0.7 : 1;
  const barHeight = 8 * scaleFactor;
  const barEndWidth = 24 * scaleFactor;
  const collarWidth = 12 * scaleFactor;

  return (
    <View style={styles.container}>
      {/* Barbell Visual */}
      <View style={styles.barbellContainer}>
        {/* Left plates (reversed order - closest to center first) */}
        <View style={styles.platesContainer}>
          {[...flatPlates].reverse().map((plate, index) => (
            <PlateView
              key={`left-${index}`}
              weight={plate.weight}
              isMicroplate={plate.isMicroplate}
              scaleFactor={scaleFactor}
            />
          ))}
        </View>

        {/* Left collar */}
        <View
          style={[
            styles.collar,
            {
              width: collarWidth,
              height: barHeight * 2,
              backgroundColor: Colors.dark.textSecondary,
            },
          ]}
        />

        {/* Bar center section */}
        <View
          style={[
            styles.barCenter,
            {
              height: barHeight,
              backgroundColor: Colors.dark.textSecondary,
            },
          ]}
        />

        {/* Right collar */}
        <View
          style={[
            styles.collar,
            {
              width: collarWidth,
              height: barHeight * 2,
              backgroundColor: Colors.dark.textSecondary,
            },
          ]}
        />

        {/* Right plates */}
        <View style={styles.platesContainer}>
          {flatPlates.map((plate, index) => (
            <PlateView
              key={`right-${index}`}
              weight={plate.weight}
              isMicroplate={plate.isMicroplate}
              scaleFactor={scaleFactor}
            />
          ))}
        </View>

        {/* Bar end caps */}
        <View
          style={[
            styles.barEnd,
            styles.barEndLeft,
            {
              width: barEndWidth,
              height: barHeight,
              backgroundColor: Colors.dark.textSecondary,
              left: 0,
            },
          ]}
        />
        <View
          style={[
            styles.barEnd,
            styles.barEndRight,
            {
              width: barEndWidth,
              height: barHeight,
              backgroundColor: Colors.dark.textSecondary,
              right: 0,
            },
          ]}
        />
      </View>

      {/* Text Breakdown */}
      {showBreakdown && (
        <View style={styles.breakdownContainer}>
          <ThemedText style={styles.totalWeight}>
            {formatWeight(result.achievedWeight)} kg
          </ThemedText>
          {platesPerSide.length > 0 && (
            <View style={styles.plateListContainer}>
              <ThemedText style={styles.perSideLabel}>Per side: </ThemedText>
              <View style={styles.plateList}>
                {platesPerSide.map((plate, index) => (
                  <View key={index} style={styles.plateItem}>
                    {plate.isMicroplate ? (
                      <View style={[styles.microplateDot, { borderColor: PLATE_COLORS[plate.weight] ?? '#888' }]}>
                        <View style={[styles.microplateDotInner, { backgroundColor: PLATE_COLORS[plate.weight] ?? '#888' }]} />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.plateDot,
                          { backgroundColor: PLATE_COLORS[plate.weight] ?? '#888' },
                        ]}
                      />
                    )}
                    <ThemedText style={styles.plateText}>
                      {plate.count > 1 ? `${plate.count}×` : ''}
                      {formatWeight(plate.weight)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
          {platesPerSide.length === 0 && (
            <ThemedText style={styles.noPlatesText}>Bar only</ThemedText>
          )}
          {!result.achievable && (
            <ThemedText style={styles.warningText}>
              Cannot achieve exact weight (off by {formatWeight(result.remainder * 2)} kg)
            </ThemedText>
          )}
          {hasMicroplates && (
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.plateDot, { backgroundColor: Colors.dark.textSecondary }]} />
                <ThemedText style={styles.legendText}>Gym</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.microplateDot, { borderColor: Colors.dark.textSecondary }]}>
                  <View style={[styles.microplateDotInner, { backgroundColor: Colors.dark.textSecondary }]} />
                </View>
                <ThemedText style={styles.legendText}>Personal</ThemedText>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

type PlateViewProps = {
  weight: number;
  isMicroplate: boolean;
  scaleFactor: number;
};

function PlateView({ weight, isMicroplate, scaleFactor }: PlateViewProps) {
  const width = getPlateWidth(weight) * scaleFactor;
  const height = getPlateHeight(weight) * scaleFactor;
  const color = PLATE_COLORS[weight] ?? '#888888';

  if (isMicroplate) {
    // Microplates have a distinctive striped pattern
    const stripeCount = 3;
    const stripeHeight = height / (stripeCount * 2 + 1);

    return (
      <View
        style={[
          styles.plate,
          styles.microplate,
          {
            width,
            height,
            backgroundColor: Colors.dark.surface,
            borderColor: color,
          },
        ]}
      >
        {/* Horizontal stripes to indicate personal plate */}
        {Array.from({ length: stripeCount }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: stripeHeight * (i * 2 + 1),
              left: 1,
              right: 1,
              height: stripeHeight,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.plate,
        {
          width,
          height,
          backgroundColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  barbellContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 24,
    minHeight: 80,
  },
  platesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  plate: {
    borderRadius: 2,
  },
  microplate: {
    borderWidth: 2,
    borderStyle: 'solid',
    overflow: 'hidden',
  },
  collar: {
    borderRadius: 2,
  },
  barCenter: {
    width: 40,
    borderRadius: 2,
  },
  barEnd: {
    position: 'absolute',
    borderRadius: 2,
  },
  barEndLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  barEndRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  breakdownContainer: {
    alignItems: 'center',
    gap: 4,
  },
  totalWeight: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  plateListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  perSideLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  plateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  plateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  microplateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  microplateDotInner: {
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  plateText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  noPlatesText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
  },
  warningText: {
    fontSize: 12,
    color: Colors.dark.error,
    marginTop: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
});
