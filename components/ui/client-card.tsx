import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export type ClientStatus = 'invited' | 'active' | 'paused' | 'archived';

export interface ClientCardProps {
  email: string;
  name?: string;
  status: ClientStatus;
  invitedAt?: number;
  acceptedAt?: number;
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

export function ClientCard({
  email,
  name,
  status,
  invitedAt,
  acceptedAt,
  onPress,
  onResendInvite,
  onCancelInvite,
}: ClientCardProps) {
  const config = STATUS_CONFIG[status];

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
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {(name || email)[0].toUpperCase()}
          </ThemedText>
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
          <ThemedText style={styles.date}>
            {status === 'invited'
              ? `Invited ${formatDate(invitedAt)}`
              : `Joined ${formatDate(acceptedAt)}`}
          </ThemedText>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.primary,
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
  date: {
    fontSize: 12,
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
