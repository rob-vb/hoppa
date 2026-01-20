import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';

export type OverviewCardProps = {
  value: string | number;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'primary';
};

export function OverviewCard({
  value,
  label,
  icon,
  iconColor,
  trend,
  variant = 'default',
}: OverviewCardProps) {
  const valueColor =
    variant === 'success'
      ? '#10B981'
      : variant === 'primary'
        ? Colors.dark.primary
        : Colors.dark.text;

  const actualIconColor = iconColor ?? valueColor;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: actualIconColor + '20' }]}>
          <MaterialIcons name={icon} size={20} color={actualIconColor} />
        </View>
        {trend !== undefined && trend.value !== 0 && (
          <View style={styles.trendContainer}>
            <MaterialIcons
              name={trend.value > 0 ? 'trending-up' : 'trending-down'}
              size={14}
              color={trend.value > 0 ? '#10B981' : '#EF4444'}
            />
            <ThemedText
              style={[
                styles.trendValue,
                { color: trend.value > 0 ? '#10B981' : '#EF4444' },
              ]}
            >
              {trend.value > 0 ? '+' : ''}
              {trend.value}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={[styles.value, { color: valueColor }]}>{value}</ThemedText>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {trend !== undefined && (
        <ThemedText style={styles.trendLabel}>{trend.label}</ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  trendLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    opacity: 0.7,
  },
});
