import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export type DateRangeOption = '1m' | '3m' | '6m' | '1y';

export interface DateRange {
  start: number;
  end: number;
  label: string;
}

const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: '1m', label: 'Last month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: 'Year' },
];

export function getDateRangeFromOption(option: DateRangeOption): DateRange {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (option) {
    case '1m':
      return { start: now - 30 * msPerDay, end: now, label: 'last month' };
    case '3m':
      return { start: now - 90 * msPerDay, end: now, label: 'last 3 months' };
    case '6m':
      return { start: now - 180 * msPerDay, end: now, label: 'last 6 months' };
    case '1y':
      return { start: now - 365 * msPerDay, end: now, label: 'last year' };
  }
}

interface DateRangeFilterProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const handleSelect = (option: DateRangeOption) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    onChange(option);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DATE_RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            style={[styles.chip, value === option.value && styles.chipActive]}
          >
            <ThemedText
              style={[styles.chipText, value === option.value && styles.chipTextActive]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  chipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '20',
  },
  chipText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  chipTextActive: {
    color: Colors.dark.primary,
    fontWeight: '500',
  },
});
