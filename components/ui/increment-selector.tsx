import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/theme';

const PRESET_INCREMENTS = [
  { value: 2.5, label: '2.5kg' },
  { value: 5, label: '5kg' },
];

interface IncrementSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
}

export function IncrementSelector({ value, onValueChange, label }: IncrementSelectorProps) {
  const numericValue = parseFloat(value);
  const isPresetValue = PRESET_INCREMENTS.some((p) => p.value === numericValue);
  const [showCustomInput, setShowCustomInput] = useState(!isPresetValue && value !== '');

  const handlePresetSelect = (presetValue: number) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setShowCustomInput(false);
    onValueChange(String(presetValue));
  };

  const handleCustomSelect = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setShowCustomInput(true);
    // Keep current value if it was custom, otherwise clear
    if (isPresetValue) {
      onValueChange('');
    }
  };

  const isCustomSelected = showCustomInput || (!isPresetValue && value !== '');

  return (
    <View style={styles.container}>
      {label && <ThemedText style={styles.label}>{label}</ThemedText>}
      <View style={styles.buttonsRow}>
        {PRESET_INCREMENTS.map((preset) => (
          <Pressable
            key={preset.value}
            onPress={() => handlePresetSelect(preset.value)}
            style={[
              styles.presetButton,
              numericValue === preset.value && !isCustomSelected && styles.presetButtonActive,
            ]}
          >
            <ThemedText
              style={[
                styles.presetButtonText,
                numericValue === preset.value && !isCustomSelected && styles.presetButtonTextActive,
              ]}
            >
              {preset.label}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={handleCustomSelect}
          style={[styles.presetButton, isCustomSelected && styles.presetButtonActive]}
        >
          <ThemedText
            style={[styles.presetButtonText, isCustomSelected && styles.presetButtonTextActive]}
          >
            Custom
          </ThemedText>
        </Pressable>
      </View>
      {isCustomSelected && (
        <View style={styles.customInputContainer}>
          <Input
            placeholder="e.g., 1.25"
            value={value}
            onChangeText={onValueChange}
            keyboardType="decimal-pad"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    backgroundColor: Colors.dark.inputBackground,
    alignItems: 'center',
  },
  presetButtonActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '20',
  },
  presetButtonText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  presetButtonTextActive: {
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  customInputContainer: {
    marginTop: 4,
  },
});
