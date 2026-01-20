import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface DataPoint {
  date: number;
  weight: number;
}

interface ExerciseProgressChartProps {
  data: DataPoint[];
  height?: number;
}

export function ExerciseProgressChart({ data, height = 180 }: ExerciseProgressChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const weights = data.map((d) => d.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    // Add padding to the range (10% on each side)
    const range = maxWeight - minWeight || 1;
    const paddedMin = Math.max(0, minWeight - range * 0.1);
    const paddedMax = maxWeight + range * 0.1;
    const paddedRange = paddedMax - paddedMin;

    // Calculate nice Y-axis ticks
    const yTicks = calculateYTicks(paddedMin, paddedMax, 4);

    return {
      points: data,
      minWeight: paddedMin,
      maxWeight: paddedMax,
      range: paddedRange,
      yTicks,
      minDate: data[0].date,
      maxDate: data[data.length - 1].date,
    };
  }, [data]);

  const handlePointPress = useCallback((point: DataPoint) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setSelectedPoint((prev) => (prev?.date === point.date ? null : point));
  }, []);

  if (!chartData || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No data available</ThemedText>
        </View>
      </View>
    );
  }

  const chartHeight = height - 40; // Reserve space for X-axis labels
  const chartWidth = containerWidth - 50; // Reserve space for Y-axis labels
  const dateRange = chartData.maxDate - chartData.minDate || 1;

  return (
    <View style={[styles.container, { height }]} onLayout={handleLayout}>
      {/* Y-Axis Labels */}
      <View style={styles.yAxisLabels}>
        {chartData.yTicks.map((tick, index) => {
          const yPos = chartHeight - ((tick - chartData.minWeight) / chartData.range) * chartHeight;
          return (
            <ThemedText
              key={index}
              style={[styles.yLabel, { top: yPos - 8 }]}
            >
              {formatWeight(tick)}
            </ThemedText>
          );
        })}
      </View>

      {/* Chart Area */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {/* Grid Lines */}
        {chartData.yTicks.map((tick, index) => {
          const yPos = chartHeight - ((tick - chartData.minWeight) / chartData.range) * chartHeight;
          return (
            <View
              key={index}
              style={[styles.gridLine, { top: yPos }]}
            />
          );
        })}

        {/* Data Points and Line */}
        {containerWidth > 0 && (
          <>
            {/* Line connecting points */}
            {data.length > 1 && data.map((point, index) => {
              if (index === 0) return null;
              const prevPoint = data[index - 1];

              const x1 = ((prevPoint.date - chartData.minDate) / dateRange) * chartWidth;
              const y1 = chartHeight - ((prevPoint.weight - chartData.minWeight) / chartData.range) * chartHeight;
              const x2 = ((point.date - chartData.minDate) / dateRange) * chartWidth;
              const y2 = chartHeight - ((point.weight - chartData.minWeight) / chartData.range) * chartHeight;

              const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.line,
                    {
                      width: length,
                      left: x1,
                      top: y1,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}

            {/* Data points */}
            {data.map((point, index) => {
              const x = ((point.date - chartData.minDate) / dateRange) * chartWidth;
              const y = chartHeight - ((point.weight - chartData.minWeight) / chartData.range) * chartHeight;
              const isSelected = selectedPoint?.date === point.date;
              const isProgressionPoint = index > 0 && point.weight > data[index - 1].weight;

              return (
                <Pressable
                  key={`point-${index}`}
                  onPress={() => handlePointPress(point)}
                  style={[
                    styles.pointTouchArea,
                    { left: x - 16, top: y - 16 },
                  ]}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.point,
                      isSelected && styles.pointSelected,
                      isProgressionPoint && styles.pointProgression,
                    ]}
                  />
                  {isSelected && (
                    <View style={styles.tooltip}>
                      <ThemedText style={styles.tooltipWeight}>
                        {point.weight}kg
                      </ThemedText>
                      <ThemedText style={styles.tooltipDate}>
                        {formatDate(point.date)}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </>
        )}
      </View>

      {/* X-Axis Labels */}
      <View style={styles.xAxisLabels}>
        <ThemedText style={styles.xLabel}>
          {formatDate(chartData.minDate)}
        </ThemedText>
        <ThemedText style={styles.xLabel}>
          {formatDate(chartData.maxDate)}
        </ThemedText>
      </View>
    </View>
  );
}

function calculateYTicks(min: number, max: number, targetCount: number): number[] {
  const range = max - min;
  const roughStep = range / (targetCount - 1);

  // Round to a nice number (1, 2, 2.5, 5, 10, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  let step = magnitude;

  if (roughStep / magnitude >= 5) {
    step = magnitude * 5;
  } else if (roughStep / magnitude >= 2.5) {
    step = magnitude * 2.5;
  } else if (roughStep / magnitude >= 2) {
    step = magnitude * 2;
  }

  // Generate ticks
  const ticks: number[] = [];
  const start = Math.floor(min / step) * step;

  for (let tick = start; tick <= max + step * 0.5; tick += step) {
    if (tick >= min - step * 0.5) {
      ticks.push(Math.round(tick * 10) / 10);
    }
  }

  return ticks;
}

function formatWeight(weight: number): string {
  if (weight % 1 === 0) {
    return `${weight}`;
  }
  return weight.toFixed(1);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.dark.textSecondary,
  },
  yAxisLabels: {
    width: 45,
    position: 'relative',
  },
  yLabel: {
    position: 'absolute',
    right: 8,
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.dark.border,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.dark.border,
    opacity: 0.5,
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.dark.primary,
    transformOrigin: 'left center',
    borderRadius: 1,
  },
  pointTouchArea: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  point: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  pointSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderColor: Colors.dark.primary,
    borderWidth: 3,
  },
  pointProgression: {
    backgroundColor: '#10B981',
    borderColor: Colors.dark.surface,
  },
  tooltip: {
    position: 'absolute',
    bottom: 28,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  tooltipWeight: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tooltipDate: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  xAxisLabels: {
    position: 'absolute',
    bottom: 0,
    left: 45,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  xLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
});
