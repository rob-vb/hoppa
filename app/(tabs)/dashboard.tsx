import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { OverviewCard } from '@/components/ui/overview-card';
import { ExerciseProgressChart } from '@/components/ui/exercise-progress-chart';
import { WeightComparisonCard } from '@/components/ui/weight-comparison-card';
import { Colors } from '@/constants/theme';
import * as db from '@/db/database';

type DateRange = 'week' | 'month' | '3months' | 'year';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '7D', value: 'week' },
  { label: '30D', value: 'month' },
  { label: '3M', value: '3months' },
  { label: '1Y', value: 'year' },
];

function getDateRangeTimestamps(range: DateRange): { start: number; end: number } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  switch (range) {
    case 'week':
      return { start: now - 7 * day, end: now };
    case 'month':
      return { start: now - 30 * day, end: now };
    case '3months':
      return { start: now - 90 * day, end: now };
    case 'year':
      return { start: now - 365 * day, end: now };
  }
}

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [stats, setStats] = useState<db.DashboardStats | null>(null);
  const [exercises, setExercises] = useState<db.ExerciseProgressData[]>([]);
  const [calendarData, setCalendarData] = useState<db.CalendarDay[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<db.ExerciseProgressData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRangeTimestamps(dateRange);

      const [statsData, exercisesData, calendarDataResult] = await Promise.all([
        db.getDashboardStats(start, end),
        db.getExercisesWithProgress(),
        db.getWorkoutCalendar(currentMonth.year, currentMonth.month),
      ]);

      setStats(statsData);
      setExercises(exercisesData);
      setCalendarData(calendarDataResult);

      // Select first exercise if none selected
      if (!selectedExercise && exercisesData.length > 0) {
        setSelectedExercise(exercisesData[0]);
      }
    } catch {
      // Error handling - stats will remain null
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currentMonth, selectedExercise]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDateRangeChange = useCallback((range: DateRange) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setDateRange(range);
  }, []);

  const handleExerciseSelect = useCallback((exercise: db.ExerciseProgressData) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setSelectedExercise(exercise);
    setSearchQuery('');
  }, []);

  const handlePreviousMonth = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setCurrentMonth((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setCurrentMonth((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const query = searchQuery.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.schemaName.toLowerCase().includes(query) ||
        e.dayName.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  // Filter weight history based on date range
  const filteredWeightHistory = useMemo(() => {
    if (!selectedExercise) return [];
    const { start, end } = getDateRangeTimestamps(dateRange);
    return selectedExercise.weightHistory.filter(
      (point) => point.date >= start && point.date <= end
    );
  }, [selectedExercise, dateRange]);

  if (isLoading && !stats) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          {DATE_RANGE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleDateRangeChange(option.value)}
              style={[
                styles.dateRangeButton,
                dateRange === option.value && styles.dateRangeButtonActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.dateRangeText,
                  dateRange === option.value && styles.dateRangeTextActive,
                ]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Overview Cards */}
        <ThemedText style={styles.sectionTitle}>Overview</ThemedText>
        <View style={styles.statsGrid}>
          <OverviewCard
            value={stats?.workoutCount ?? 0}
            label="Workouts"
            icon="fitness-center"
            variant="primary"
            trend={
              stats
                ? {
                    value: stats.workoutCountDiff,
                    label: 'vs previous period',
                  }
                : undefined
            }
          />
          <OverviewCard
            value={stats?.progressionCount ?? 0}
            label="Progressions"
            icon="trending-up"
            variant="success"
            trend={
              stats
                ? {
                    value: stats.progressionCountDiff,
                    label: 'vs previous period',
                  }
                : undefined
            }
          />
          <OverviewCard
            value={formatVolume(stats?.totalVolume ?? 0)}
            label="Volume (kg)"
            icon="monitor-weight"
            trend={
              stats
                ? {
                    value: Math.round(stats.totalVolumeDiff / 1000),
                    label: 'kg vs previous',
                  }
                : undefined
            }
          />
          <OverviewCard
            value={stats?.totalReps ?? 0}
            label="Total Reps"
            icon="repeat"
            trend={
              stats
                ? {
                    value: stats.totalRepsDiff,
                    label: 'vs previous period',
                  }
                : undefined
            }
          />
        </View>

        {/* Exercise Progress */}
        <ThemedText style={styles.sectionTitle}>Exercise Progress</ThemedText>
        <Card style={styles.exerciseProgressCard}>
          {/* Exercise Selector */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={Colors.dark.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {searchQuery ? (
            <ScrollView style={styles.exerciseList} nestedScrollEnabled>
              {filteredExercises.map((exercise) => (
                <Pressable
                  key={exercise.exerciseId}
                  style={[
                    styles.exerciseItem,
                    selectedExercise?.exerciseId === exercise.exerciseId &&
                      styles.exerciseItemActive,
                  ]}
                  onPress={() => handleExerciseSelect(exercise)}
                >
                  <View style={styles.exerciseItemContent}>
                    <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
                    <ThemedText style={styles.exerciseMeta}>
                      {exercise.schemaName} - {exercise.dayName}
                    </ThemedText>
                  </View>
                  <View style={styles.exerciseStats}>
                    <ThemedText style={styles.exerciseWeight}>
                      {exercise.currentWeight}kg
                    </ThemedText>
                    {exercise.currentWeight > exercise.startingWeight && (
                      <ThemedText style={styles.exerciseGain}>
                        +{(exercise.currentWeight - exercise.startingWeight).toFixed(1)}kg
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              ))}
              {filteredExercises.length === 0 && (
                <ThemedText style={styles.noResults}>No exercises found</ThemedText>
              )}
            </ScrollView>
          ) : selectedExercise ? (
            <>
              {/* Selected Exercise Info */}
              <Pressable
                style={styles.selectedExercise}
                onPress={() => setSearchQuery(' ')}
              >
                <View>
                  <ThemedText style={styles.selectedExerciseName}>
                    {selectedExercise.name}
                  </ThemedText>
                  <ThemedText style={styles.selectedExerciseMeta}>
                    {selectedExercise.schemaName} - {selectedExercise.dayName}
                  </ThemedText>
                </View>
                <ThemedText style={styles.changeText}>Change</ThemedText>
              </Pressable>

              {/* Weight Progress Chart */}
              <View style={styles.chartContainer}>
                {filteredWeightHistory.length > 0 ? (
                  <ExerciseProgressChart data={filteredWeightHistory} height={180} />
                ) : (
                  <View style={styles.noDataContainer}>
                    <ThemedText style={styles.noDataText}>
                      No workout data for this period
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Weight Comparison */}
              <WeightComparisonCard
                startingWeight={selectedExercise.startingWeight}
                currentWeight={selectedExercise.currentWeight}
              />

              {/* Progressions Count */}
              <View style={styles.progressionsRow}>
                <MaterialIcons name="emoji-events" size={18} color={Colors.dark.primary} />
                <ThemedText style={styles.progressionsText}>
                  {selectedExercise.progressionCount} progression
                  {selectedExercise.progressionCount !== 1 ? 's' : ''} earned
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <ThemedText style={styles.noDataText}>
                Create a schema with exercises to see progress
              </ThemedText>
            </View>
          )}
        </Card>

        {/* Workout Calendar */}
        <ThemedText style={styles.sectionTitle}>Workout Calendar</ThemedText>
        <Card style={styles.calendarCard}>
          {/* Month Navigation */}
          <View style={styles.calendarHeader}>
            <Pressable onPress={handlePreviousMonth} style={styles.calendarNavButton}>
              <ThemedText style={styles.calendarNavText}>{'<'}</ThemedText>
            </Pressable>
            <ThemedText style={styles.calendarMonth}>
              {new Date(currentMonth.year, currentMonth.month - 1).toLocaleDateString(
                undefined,
                { month: 'long', year: 'numeric' }
              )}
            </ThemedText>
            <Pressable onPress={handleNextMonth} style={styles.calendarNavButton}>
              <ThemedText style={styles.calendarNavText}>{'>'}</ThemedText>
            </Pressable>
          </View>

          {/* Day Headers */}
          <View style={styles.calendarDayHeaders}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <ThemedText key={day} style={styles.calendarDayHeader}>
                {day}
              </ThemedText>
            ))}
          </View>

          {/* Calendar Grid */}
          <CalendarGrid
            calendarData={calendarData}
            year={currentMonth.year}
            month={currentMonth.month}
          />

          {/* Legend */}
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotCompleted]} />
              <ThemedText style={styles.legendText}>Completed</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotInProgress]} />
              <ThemedText style={styles.legendText}>In Progress</ThemedText>
            </View>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

// Calendar grid component
function CalendarGrid({
  calendarData,
  year,
  month,
}: {
  calendarData: db.CalendarDay[];
  year: number;
  month: number;
}) {
  // Get the first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  // Convert to Monday-first (0 = Monday, 6 = Sunday)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  // Create array with empty cells for offset + actual days
  const cells: (db.CalendarDay | null)[] = [
    ...Array(startOffset).fill(null),
    ...calendarData,
  ];

  // Pad to complete weeks
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (db.CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.calendarGrid}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarWeek}>
          {week.map((day, dayIndex) => {
            if (!day) {
              return <View key={dayIndex} style={styles.calendarDay} />;
            }

            const dayNum = new Date(day.date).getDate();
            const isToday = isCurrentMonth && dayNum === todayDate;

            return (
              <View
                key={dayIndex}
                style={[
                  styles.calendarDay,
                  isToday && styles.calendarDayToday,
                ]}
              >
                <ThemedText
                  style={[
                    styles.calendarDayText,
                    isToday && styles.calendarDayTextToday,
                  ]}
                >
                  {dayNum}
                </ThemedText>
                {day.hasWorkout && (
                  <View
                    style={[
                      styles.workoutIndicator,
                      day.isCompleted
                        ? styles.workoutIndicatorCompleted
                        : styles.workoutIndicatorInProgress,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  dateRangeTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  exerciseProgressCard: {
    marginBottom: 24,
    padding: 16,
  },
  searchInput: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  exerciseList: {
    maxHeight: 200,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  exerciseItemActive: {
    backgroundColor: Colors.dark.primary + '20',
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  exerciseMeta: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  exerciseStats: {
    alignItems: 'flex-end',
  },
  exerciseWeight: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  exerciseGain: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  noResults: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    paddingVertical: 20,
  },
  selectedExercise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  selectedExerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  selectedExerciseMeta: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  chartContainer: {
    height: 180,
    marginBottom: 16,
  },
  noDataContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  progressionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  progressionsText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  calendarCard: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarNavText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  calendarMonth: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  calendarDayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  calendarGrid: {
    gap: 4,
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarDayToday: {
    backgroundColor: Colors.dark.primary + '30',
  },
  calendarDayText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  calendarDayTextToday: {
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  workoutIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 4,
  },
  workoutIndicatorCompleted: {
    backgroundColor: '#10B981',
  },
  workoutIndicatorInProgress: {
    backgroundColor: Colors.dark.primary,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotCompleted: {
    backgroundColor: '#10B981',
  },
  legendDotInProgress: {
    backgroundColor: Colors.dark.primary,
  },
  legendText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
