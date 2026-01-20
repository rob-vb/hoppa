import { useCallback, useEffect, useRef, useState, useMemo, memo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  LayoutChangeEvent,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ExerciseCard } from '@/components/ui/exercise-card';
import { RepInput } from '@/components/ui/rep-input';
import { WorkoutSummary, WorkoutSummaryData } from '@/components/ui/workout-summary';
import { useWorkoutStore } from '@/stores/workout-store';
import { Colors } from '@/constants/theme';

// Extracted formatting function to avoid recreation
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Memoized progress bar component to prevent re-renders on timer tick
type ExerciseLogForProgress = {
  id: string;
  status: string;
};

interface ProgressBarProps {
  exerciseLogs: ExerciseLogForProgress[];
  currentExerciseIndex: number;
}

const ProgressBar = memo(function ProgressBar({
  exerciseLogs,
  currentExerciseIndex,
}: ProgressBarProps) {
  return (
    <View style={styles.progressBarBackground}>
      {exerciseLogs.map((log, index) => (
        <View
          key={log.id}
          style={[
            styles.progressSegment,
            index === currentExerciseIndex && styles.progressSegmentCurrent,
            (log.status === 'completed' || log.status === 'skipped') &&
              styles.progressSegmentCompleted,
          ]}
        />
      ))}
    </View>
  );
});

// Memoized exercise navigation dots
interface ExerciseNavDotsProps {
  exerciseLogs: ExerciseLogForProgress[];
  currentExerciseIndex: number;
  onSelectExercise: (index: number) => void;
}

const ExerciseNavDots = memo(function ExerciseNavDots({
  exerciseLogs,
  currentExerciseIndex,
  onSelectExercise,
}: ExerciseNavDotsProps) {
  return (
    <View style={styles.exerciseNav}>
      {exerciseLogs.map((log, index) => (
        <Pressable
          key={log.id}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Haptics.selectionAsync();
            }
            onSelectExercise(index);
          }}
          style={[
            styles.navDot,
            index === currentExerciseIndex && styles.navDotActive,
            (log.status === 'completed' || log.status === 'skipped') &&
              styles.navDotCompleted,
          ]}
        />
      ))}
    </View>
  );
});

export default function ActiveWorkoutScreen() {
  useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();

  // Use individual selectors to minimize re-renders
  const session = useWorkoutStore((state) => state.session);
  const exerciseLogs = useWorkoutStore((state) => state.exerciseLogs);
  const currentExerciseIndex = useWorkoutStore((state) => state.currentExerciseIndex);
  const isLoading = useWorkoutStore((state) => state.isLoading);
  const error = useWorkoutStore((state) => state.error);

  // Get action functions (these are stable references)
  const setCurrentExercise = useWorkoutStore((state) => state.setCurrentExercise);
  const nextExercise = useWorkoutStore((state) => state.nextExercise);
  const previousExercise = useWorkoutStore((state) => state.previousExercise);
  const logReps = useWorkoutStore((state) => state.logReps);
  const clearReps = useWorkoutStore((state) => state.clearReps);
  const completeExercise = useWorkoutStore((state) => state.completeExercise);
  const skipExercise = useWorkoutStore((state) => state.skipExercise);
  const completeWorkout = useWorkoutStore((state) => state.completeWorkout);
  const cancelWorkout = useWorkoutStore((state) => state.cancelWorkout);
  const getCurrentExerciseLog = useWorkoutStore((state) => state.getCurrentExerciseLog);
  const isExerciseComplete = useWorkoutStore((state) => state.isExerciseComplete);
  const getCompletedSetsCount = useWorkoutStore((state) => state.getCompletedSetsCount);

  const currentExerciseLog = getCurrentExerciseLog();
  const scrollViewRef = useRef<ScrollView>(null);
  const setPositions = useRef<Record<string, number>>({});

  // Workout timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Summary modal state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<WorkoutSummaryData | null>(null);

  // Debounce state to prevent double-tap issues
  const [isProcessingExercise, setIsProcessingExercise] = useState(false);

  useEffect(() => {
    if (!session) return;

    // Calculate initial elapsed time
    const calculateElapsed = () => Math.floor((Date.now() - session.startedAt) / 1000);
    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Memoize formatted time to avoid string creation on every render
  const formattedTime = useMemo(() => formatTime(elapsedSeconds), [elapsedSeconds]);

  const handleRepSelect = useCallback(
    async (reps: number, setId: string, setIndex: number) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await logReps(setId, reps);

      // Auto-advance to next set
      if (currentExerciseLog) {
        const sets = currentExerciseLog.sets;
        const nextSetIndex = setIndex + 1;

        if (nextSetIndex < sets.length) {
          const nextSet = sets[nextSetIndex];
          const nextSetY = setPositions.current[nextSet.id];

          if (nextSetY !== undefined && scrollViewRef.current) {
            // Scroll to make the next set visible with some padding
            scrollViewRef.current.scrollTo({ y: nextSetY - 100, animated: true });
          }
        }
      }
    },
    [logReps, currentExerciseLog]
  );

  const handleSetLayout = useCallback((setId: string, event: LayoutChangeEvent) => {
    setPositions.current[setId] = event.nativeEvent.layout.y;
  }, []);

  const handleClearReps = useCallback(
    async (setId: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await clearReps(setId);
    },
    [clearReps]
  );

  const handleCompleteExercise = useCallback(async () => {
    if (!currentExerciseLog || isProcessingExercise) return;

    setIsProcessingExercise(true);
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await completeExercise(currentExerciseLog.id);

      // Auto-advance to next exercise
      if (currentExerciseIndex < exerciseLogs.length - 1) {
        nextExercise();
      }
    } finally {
      setIsProcessingExercise(false);
    }
  }, [currentExerciseLog, completeExercise, currentExerciseIndex, exerciseLogs.length, nextExercise, isProcessingExercise]);

  const handleSkipExercise = useCallback(async () => {
    if (!currentExerciseLog || isProcessingExercise) return;

    setIsProcessingExercise(true);
    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await skipExercise(currentExerciseLog.id);

      // Auto-advance to next exercise
      if (currentExerciseIndex < exerciseLogs.length - 1) {
        nextExercise();
      }
    } finally {
      setIsProcessingExercise(false);
    }
  }, [currentExerciseLog, skipExercise, currentExerciseIndex, exerciseLogs.length, nextExercise, isProcessingExercise]);

  const handleFinishWorkout = useCallback(async () => {
    Alert.alert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            const summary = await completeWorkout();
            if (summary) {
              setSummaryData(summary);
              setShowSummary(true);
            } else {
              router.back();
            }
          },
        },
      ]
    );
  }, [completeWorkout, router]);

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false);
    setSummaryData(null);
    router.back();
  }, [router]);

  const handleCancelWorkout = useCallback(() => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel? All progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: async () => {
            await cancelWorkout();
            router.back();
          },
        },
      ]
    );
  }, [cancelWorkout, router]);

  const handleClose = useCallback(() => {
    // If workout is in progress, ask to confirm
    if (session) {
      Alert.alert(
        'Leave Workout',
        'Your workout will remain active. You can resume it later.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [session, router]);

  // Memoize computed values
  const completedExercises = useMemo(
    () =>
      exerciseLogs.filter(
        (log) => log.status === 'completed' || log.status === 'skipped'
      ).length,
    [exerciseLogs]
  );

  const totalExercises = exerciseLogs.length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session || !currentExerciseLog) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            {error || 'No active workout session'}
          </ThemedText>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const { exercise, sets, status, progressionEarned } = currentExerciseLog;
  const completedSets = getCompletedSetsCount(currentExerciseLog.id);
  const isCurrentExerciseComplete = isExerciseComplete(currentExerciseLog.id);
  const someSetsCompleted = completedSets > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} hitSlop={12}>
          <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
        </Pressable>

        <View style={styles.timerContainer}>
          <IconSymbol name="timer" size={16} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.timerText}>{formattedTime}</ThemedText>
        </View>

        <Pressable onPress={handleCancelWorkout} hitSlop={12}>
          <ThemedText style={styles.cancelText}>Cancel</ThemedText>
        </Pressable>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressSection}>
        <View style={styles.progressTextRow}>
          <ThemedText style={styles.progressLabel}>
            Exercise {currentExerciseIndex + 1} of {totalExercises}
          </ThemedText>
          <ThemedText style={styles.progressCompleted}>
            {completedExercises} completed
          </ThemedText>
        </View>
        <View style={styles.progressBarContainer}>
          <ProgressBar
            exerciseLogs={exerciseLogs}
            currentExerciseIndex={currentExerciseIndex}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Exercise Card */}
        <ExerciseCard
          exercise={exercise}
          sets={sets}
          totalWeight={currentExerciseLog.totalWeight}
          status={status}
          progressionEarned={progressionEarned}
          completedSetsCount={completedSets}
        />

        {/* Rep Input - Quick Buttons for each Set */}
        {!isCurrentExerciseComplete && (
          <View style={styles.repInputSection}>
            {sets.map((set, index) => (
              <View
                key={set.id}
                onLayout={(e) => handleSetLayout(set.id, e)}
              >
                <RepInput
                  setNumber={index + 1}
                  targetReps={`${exercise.targetRepsMin}-${exercise.targetRepsMax}`}
                  completedReps={set.completedReps}
                  onLogReps={(reps) => handleRepSelect(reps, set.id, index)}
                  onClearReps={() => handleClearReps(set.id)}
                  disabled={isCurrentExerciseComplete}
                />
              </View>
            ))}
          </View>
        )}

        {/* Exercise Actions */}
        <View style={styles.exerciseActions}>
          {!isCurrentExerciseComplete ? (
            <>
              <Button
                title={isProcessingExercise ? 'Processing...' : 'Finish Exercise'}
                onPress={handleCompleteExercise}
                disabled={!someSetsCompleted || isProcessingExercise}
                fullWidth
              />
              <Button
                title="Skip Exercise"
                variant="ghost"
                onPress={handleSkipExercise}
                disabled={isProcessingExercise}
                fullWidth
              />
            </>
          ) : (
            <View style={styles.completedBadge}>
              <IconSymbol
                name={status === 'skipped' ? 'forward.fill' : 'checkmark.circle.fill'}
                size={20}
                color={status === 'skipped' ? Colors.dark.textSecondary : '#22C55E'}
              />
              <ThemedText
                style={[
                  styles.completedText,
                  status === 'skipped' && styles.skippedText,
                ]}
              >
                {status === 'skipped' ? 'Exercise Skipped' : 'Exercise Completed'}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Exercise Navigation */}
        <ExerciseNavDots
          exerciseLogs={exerciseLogs}
          currentExerciseIndex={currentExerciseIndex}
          onSelectExercise={setCurrentExercise}
        />
      </ScrollView>

      {/* Bottom Navigation */}
      <SafeAreaView edges={['bottom']} style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.selectionAsync();
              }
              previousExercise();
            }}
            disabled={currentExerciseIndex === 0}
            style={({ pressed }) => [
              styles.navButton,
              currentExerciseIndex === 0 && styles.navButtonDisabled,
              pressed && styles.navButtonPressed,
            ]}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={
                currentExerciseIndex === 0
                  ? Colors.dark.textSecondary
                  : Colors.dark.text
              }
            />
            <ThemedText
              style={[
                styles.navButtonText,
                currentExerciseIndex === 0 && styles.navButtonTextDisabled,
              ]}
            >
              Previous
            </ThemedText>
          </Pressable>

          {completedExercises === totalExercises ? (
            <Button title="Finish Workout" onPress={handleFinishWorkout} />
          ) : (
            <Pressable
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.selectionAsync();
                }
                nextExercise();
              }}
              disabled={currentExerciseIndex === totalExercises - 1}
              style={({ pressed }) => [
                styles.navButton,
                currentExerciseIndex === totalExercises - 1 &&
                  styles.navButtonDisabled,
                pressed && styles.navButtonPressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.navButtonText,
                  currentExerciseIndex === totalExercises - 1 &&
                    styles.navButtonTextDisabled,
                ]}
              >
                Next
              </ThemedText>
              <IconSymbol
                name="chevron.right"
                size={24}
                color={
                  currentExerciseIndex === totalExercises - 1
                    ? Colors.dark.textSecondary
                    : Colors.dark.text
                }
              />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* Workout Summary Modal */}
      <Modal
        visible={showSummary}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {summaryData && (
            <WorkoutSummary data={summaryData} onDone={handleSummaryDone} />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    color: Colors.dark.error,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: Colors.dark.text,
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  progressCompleted: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarBackground: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 3,
  },
  progressSegmentCurrent: {
    backgroundColor: Colors.dark.primary,
  },
  progressSegmentCompleted: {
    backgroundColor: '#22C55E',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  repInputSection: {
    marginTop: 16,
    gap: 12,
  },
  exerciseActions: {
    gap: 12,
    marginBottom: 24,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 16,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
  skippedText: {
    color: Colors.dark.textSecondary,
  },
  exerciseNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surface,
  },
  navDotActive: {
    backgroundColor: Colors.dark.primary,
    width: 24,
  },
  navDotCompleted: {
    backgroundColor: '#22C55E',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  bottomNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  navButtonTextDisabled: {
    color: Colors.dark.textSecondary,
  },
});
