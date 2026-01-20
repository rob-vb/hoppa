import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Schema } from '@/db/types';

export type SchemaCardProps = {
  schema: Schema;
  onPress?: () => void;
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SchemaCard({ schema, onPress }: SchemaCardProps) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold" style={styles.name}>
          {schema.name}
        </ThemedText>
        {schema.progressiveLoadingEnabled && (
          <View style={styles.progressionBadge}>
            <ThemedText style={styles.progressionBadgeText}>
              Progressive
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={styles.date}>
        Updated {formatDate(schema.updatedAt)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    flex: 1,
  },
  progressionBadge: {
    backgroundColor: Colors.dark.primary + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressionBadgeText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  date: {
    fontSize: 14,
    opacity: 0.6,
  },
});
