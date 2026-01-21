import { memo, useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export type RepInputProps = {
  setNumber: number;
  targetReps: string;
  completedReps: number | null;
  onLogReps: (reps: number) => void;
  onClearReps: () => void;
  disabled?: boolean;
};

export const RepInput = memo(function RepInput({
  setNumber,
  targetReps,
  completedReps,
  onLogReps,
  onClearReps,
  disabled = false,
}: RepInputProps) {
  const isCompleted = completedReps !== null;

  // Parse target reps to get quick button values - memoize to avoid recalculation
  const { minReps, quickButtons } = useMemo(() => {
    const [min, max] = targetReps.split('-').map(Number);
    return {
      minReps: min,
      quickButtons: generateQuickButtons(min, max),
    };
  }, [targetReps]);

  const meetsTarget = completedReps !== null && completedReps >= minReps;

  const handleQuickButton = useCallback((reps: number) => {
    if (disabled) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLogReps(reps);
  }, [disabled, onLogReps]);

  const handleClear = useCallback(() => {
    if (disabled || !isCompleted) return;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClearReps();
  }, [disabled, isCompleted, onClearReps]);

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    const newReps = (completedReps ?? 0) + 1;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onLogReps(newReps);
  }, [disabled, completedReps, onLogReps]);

  const handleDecrement = useCallback(() => {
    if (disabled || completedReps === null || completedReps <= 0) return;
    const newReps = completedReps - 1;
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (newReps === 0) {
      onClearReps();
    } else {
      onLogReps(newReps);
    }
  }, [disabled, completedReps, onLogReps, onClearReps]);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Set Header */}
      <View style={styles.header}>
        <View style={styles.setInfo}>
          <ThemedText type="defaultSemiBold" style={styles.setLabel}>
            Set {setNumber}
          </ThemedText>
          <ThemedText style={styles.targetReps}>
            Target: {targetReps} reps
          </ThemedText>
        </View>
        {isCompleted && (
          <Pressable
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={8}
          >
            <IconSymbol
              name="xmark.circle.fill"
              size={20}
              color={Colors.dark.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/* Rep Display and Controls */}
      <View style={styles.inputRow}>
        {/* Decrement Button */}
        <Pressable
          onPress={handleDecrement}
          style={({ pressed }) => [
            styles.incrementButton,
            pressed && styles.buttonPressed,
            (!isCompleted || completedReps === 0) && styles.buttonDisabled,
          ]}
          disabled={disabled || !isCompleted || completedReps === 0}
        >
          <IconSymbol
            name="minus"
            size={24}
            color={
              isCompleted && completedReps! > 0
                ? Colors.dark.text
                : Colors.dark.textSecondary
            }
          />
        </Pressable>

        {/* Rep Display */}
        <View
          style={[
            styles.repDisplay,
            isCompleted && styles.repDisplayCompleted,
            meetsTarget && styles.repDisplayMeetsTarget,
          ]}
        >
          <View style={styles.repValueRow}>
            <ThemedText
              style={[
                styles.repValue,
                isCompleted && styles.repValueCompleted,
                meetsTarget && styles.repValueMeetsTarget,
              ]}
            >
              {completedReps ?? '-'}
            </ThemedText>
            {meetsTarget && (
              <IconSymbol
                name="checkmark.circle.fill"
                size={24}
                color="#22C55E"
              />
            )}
          </View>
          <ThemedText style={styles.repUnit}>reps</ThemedText>
        </View>

        {/* Increment Button */}
        <Pressable
          onPress={handleIncrement}
          style={({ pressed }) => [
            styles.incrementButton,
            pressed && styles.buttonPressed,
          ]}
          disabled={disabled}
        >
          <IconSymbol name="plus" size={24} color={Colors.dark.text} />
        </Pressable>
      </View>

      {/* Quick Buttons */}
      <View style={styles.quickButtons}>
        {quickButtons.map((reps) => (
          <Pressable
            key={reps}
            onPress={() => handleQuickButton(reps)}
            style={({ pressed }) => [
              styles.quickButton,
              completedReps === reps && styles.quickButtonSelected,
              pressed && styles.buttonPressed,
            ]}
            disabled={disabled}
          >
            <ThemedText
              style={[
                styles.quickButtonText,
                completedReps === reps && styles.quickButtonTextSelected,
              ]}
            >
              {reps}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

function generateQuickButtons(min: number, max: number): number[] {
  const buttons: number[] = [];

  // Always include min and max
  if (min > 0) buttons.push(min);

  // Add middle values
  const mid = Math.floor((min + max) / 2);
  if (mid > min && mid < max) {
    buttons.push(mid);
  }

  if (max > min) buttons.push(max);

  // Add one above max for progression
  buttons.push(max + 1);

  return buttons;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  setInfo: {
    gap: 2,
  },
  setLabel: {
    fontSize: 18,
  },
  targetReps: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  clearButton: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  incrementButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  repDisplay: {
    minWidth: 100,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.inputBackground,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repDisplayCompleted: {
    borderColor: Colors.dark.primary,
    backgroundColor: `${Colors.dark.primary}20`,
  },
  repDisplayMeetsTarget: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E20',
  },
  repValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  repValueCompleted: {
    color: Colors.dark.text,
  },
  repValueMeetsTarget: {
    color: '#22C55E',
  },
  repUnit: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  quickButton: {
    minWidth: 56,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickButtonSelected: {
    backgroundColor: Colors.dark.primary,
  },
  quickButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  quickButtonTextSelected: {
    color: '#FFFFFF',
  },
});
