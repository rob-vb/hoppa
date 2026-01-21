import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { usePremium } from '@/hooks/use-premium';
import { Colors } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPremium, currentPlan, showPaywall } = usePremium();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      // Web doesn't have Alert, proceed directly
      await performLogout();
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await signOut();
      router.replace('/auth/login');
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {getInitials(user?.name, user?.email)}
            </ThemedText>
          </View>
          <View style={styles.profileInfo}>
            {user?.name && (
              <ThemedText style={styles.profileName}>{user.name}</ThemedText>
            )}
            {user?.email && (
              <ThemedText style={styles.profileEmail}>{user.email}</ThemedText>
            )}
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Subscription</ThemedText>
          {isPremium ? (
            <View style={styles.card}>
              <View style={styles.premiumRow}>
                <View style={styles.premiumBadge}>
                  <ThemedText style={styles.premiumBadgeText}>PRO</ThemedText>
                </View>
                <View style={styles.premiumInfo}>
                  <ThemedText style={styles.premiumTitle}>Premium Active</ThemedText>
                  <ThemedText style={styles.premiumPlan}>
                    {currentPlan === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={showPaywall}
              style={({ pressed }) => [
                styles.upgradeCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.upgradeContent}>
                <ThemedText style={styles.upgradeTitle}>Upgrade to Premium</ThemedText>
                <ThemedText style={styles.upgradeDescription}>
                  Unlock unlimited schemas, AI import, and more
                </ThemedText>
              </View>
              <ThemedText style={styles.upgradeArrow}>→</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <View style={styles.card}>
            <ProfileRow
              label="Email"
              value={user?.email ?? 'Not set'}
            />
            <View style={styles.divider} />
            <ProfileRow
              label="Name"
              value={user?.name ?? 'Not set'}
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            variant="secondary"
            onPress={handleLogout}
            loading={isLoggingOut}
            fullWidth
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

interface ProfileRowProps {
  label: string;
  value: string;
  onPress?: () => void;
}

function ProfileRow({ label, value, onPress }: ProfileRowProps) {
  const content = (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  rowValue: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginLeft: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  logoutSection: {
    marginTop: 8,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  premiumBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  premiumPlan: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  upgradeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.primary + '40',
  },
  upgradeContent: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  upgradeDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  upgradeArrow: {
    fontSize: 20,
    color: Colors.dark.primary,
    marginLeft: 12,
  },
});
