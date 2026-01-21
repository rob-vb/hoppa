import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export type ClientStatus = 'invited' | 'active' | 'paused' | 'archived';

export type ActivityLevel = 'high' | 'medium' | 'low' | 'inactive' | 'none';

export interface ClientCardProps {
  email: string;
  name?: string;
  status: ClientStatus;
  invitedAt?: number;
  acceptedAt?: number;
  lastWorkout?: number | null;
  totalWorkouts?: number;
  workoutsThisWeek?: number;
  onPress?: () => void;
  onResendInvite?: () => void;
  onCancelInvite?: () => void;
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  invited: { label: 'Pending', color: '#F59E0B', icon: 'schedule' },
  active: { label: 'Active', color: '#10B981', icon: 'check-circle' },
  paused: { label: 'Paused', color: '#6B7280', icon: 'pause-circle-filled' },
  archived: { label: 'Archived', color: '#6B7280', icon: 'archive' },
};

const ACTIVITY_CONFIG: Record<
  ActivityLevel,
  { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  high: { label: 'Active', color: '#10B981', icon: 'local-fire-department' },
  medium: { label: 'Regular', color: '#3B82F6', icon: 'trending-up' },
  low: { label: 'Slow', color: '#F59E0B', icon: 'trending-down' },
  inactive: { label: 'Inactive', color: '#EF4444', icon: 'warning' },
  none: { label: 'New', color: '#6B7280', icon: 'fiber-new' },
};

function getActivityLevel(lastWorkout: number | null | undefined, workoutsThisWeek: number = 0): ActivityLevel {
  if (lastWorkout === null || lastWorkout === undefined) {
    return 'none';
  }

  const daysSinceLastWorkout = Math.floor((Date.now() - lastWorkout) / (24 * 60 * 60 * 1000));

  if (workoutsThisWeek >= 3 || daysSinceLastWorkout <= 2) {
    return 'high';
  }
  if (workoutsThisWeek >= 1 || daysSinceLastWorkout <= 5) {
    return 'medium';
  }
  if (daysSinceLastWorkout <= 14) {
    return 'low';
  }
  return 'inactive';
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours === 0) {
      return 'Just now';
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months}mo ago`;
}

export function ClientCard({
  email,
  name,
  status,
  invitedAt,
  acceptedAt,
  lastWorkout,
  totalWorkouts = 0,
  workoutsThisWeek = 0,
  onPress,
  onResendInvite,
  onCancelInvite,
}: ClientCardProps) {
  const config = STATUS_CONFIG[status];
  const activityLevel = status === 'active' ? getActivityLevel(lastWorkout, workoutsThisWeek) : null;
  const activityConfig = activityLevel ? ACTIVITY_CONFIG[activityLevel] : null;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const handleResend = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onResendInvite?.();
  };

  const handleCancel = () => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onCancelInvite?.();
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {(name || email)[0].toUpperCase()}
            </ThemedText>
          </View>
          {activityConfig && (
            <View style={[styles.activityDot, { backgroundColor: activityConfig.color }]} />
          )}
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {name || email}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
              <MaterialIcons name={config.icon} size={12} color={config.color} />
              <ThemedText style={[styles.statusText, { color: config.color }]}>
                {config.label}
              </ThemedText>
            </View>
          </View>
          {name && (
            <ThemedText style={styles.email} numberOfLines={1}>
              {email}
            </ThemedText>
          )}
          <View style={styles.metaRow}>
            <ThemedText style={styles.date}>
              {status === 'invited'
                ? `Invited ${formatDate(invitedAt)}`
                : `Joined ${formatDate(acceptedAt)}`}
            </ThemedText>
            {status === 'active' && activityConfig && (
              <>
                <View style={styles.metaDot} />
                {lastWorkout ? (
                  <View style={styles.activityInfo}>
                    <MaterialIcons
                      name={activityConfig.icon}
                      size={12}
                      color={activityConfig.color}
                    />
                    <ThemedText style={[styles.activityText, { color: activityConfig.color }]}>
                      {formatRelativeTime(lastWorkout)}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.noActivity}>No workouts yet</ThemedText>
                )}
              </>
            )}
          </View>
          {status === 'active' && totalWorkouts > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialIcons name="fitness-center" size={12} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.statText}>
                  {totalWorkouts} total
                </ThemedText>
              </View>
              {workoutsThisWeek > 0 && (
                <View style={styles.statItem}>
                  <MaterialIcons name="calendar-today" size={12} color={Colors.dark.textSecondary} />
                  <ThemedText style={styles.statText}>
                    {workoutsThisWeek} this week
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {status === 'invited' && (onResendInvite || onCancelInvite) && (
        <View style={styles.actions}>
          {onResendInvite && (
            <Pressable
              onPress={handleResend}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="send" size={18} color={Colors.dark.primary} />
            </Pressable>
          )}
          {onCancelInvite && (
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="close" size={18} color="#EF4444" />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  activityDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  email: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textSecondary,
    marginHorizontal: 6,
  },
  date: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noActivity: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
