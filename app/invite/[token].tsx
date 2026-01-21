import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useAction } from 'convex/react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/contexts/auth-context';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const invitation = useQuery(api.clientInvitations.getInvitationDetails, {
    token: token || '',
  });
  const acceptInvitation = useAction(api.clientInvitations.acceptInvitation);

  const handleAccept = async () => {
    if (!token) return;

    setError(null);
    setIsAccepting(true);

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const result = await acceptInvitation({ token });

      if (result.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setSuccess(true);
      } else if (result.requiresAuth) {
        // User needs to sign in first - redirect to login with return URL
        router.replace({
          pathname: '/auth/login',
          params: { returnTo: `/invite/${token}` },
        });
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setError(result.error || 'Failed to accept invitation');
      }
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setError('An unexpected error occurred');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)/(home)');
  };

  const handleLogin = () => {
    router.push({
      pathname: '/auth/login',
      params: { returnTo: `/invite/${token}` },
    });
  };

  // Auto-accept if user is logged in and comes back to this screen
  useEffect(() => {
    if (user && invitation && !invitation.expired && !success && !error && !isAccepting) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invitation]);

  // Loading state
  if (authLoading || invitation === undefined) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <ThemedText style={styles.loadingText}>Loading invitation...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Invalid or not found
  if (!invitation) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
          </View>
          <ThemedText style={styles.title}>Invalid Invitation</ThemedText>
          <ThemedText style={styles.description}>
            This invitation link is invalid or has been revoked.
          </ThemedText>
          <View style={styles.buttonWrapper}>
            <Button title="Go to Home" onPress={handleGoHome} fullWidth />
          </View>
        </View>
      </ThemedView>
    );
  }

  // Expired
  if (invitation.expired) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="schedule" size={64} color="#F59E0B" />
          </View>
          <ThemedText style={styles.title}>Invitation Expired</ThemedText>
          <ThemedText style={styles.description}>
            This invitation has expired. Please ask your trainer to send a new invitation.
          </ThemedText>
          <View style={styles.buttonWrapper}>
            <Button title="Go to Home" onPress={handleGoHome} fullWidth />
          </View>
        </View>
      </ThemedView>
    );
  }

  // Success
  if (success) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={80} color="#10B981" />
          </View>
          <ThemedText style={styles.title}>You&apos;re Connected!</ThemedText>
          <ThemedText style={styles.description}>
            You&apos;re now connected with {invitation.trainerName}. They can send you
            workout schemas directly to your app.
          </ThemedText>
          <View style={styles.buttonWrapper}>
            <Button title="Get Started" onPress={handleGoHome} fullWidth />
          </View>
        </View>
      </ThemedView>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="fitness-center" size={64} color={Colors.dark.primary} />
          </View>
          <ThemedText style={styles.title}>You&apos;re Invited!</ThemedText>
          <ThemedText style={styles.trainerName}>
            {invitation.trainerName}
          </ThemedText>
          <ThemedText style={styles.description}>
            wants you to join them on Hoppa for personalized workout training.
          </ThemedText>
          <ThemedText style={styles.signInPrompt}>
            Sign in or create an account to accept this invitation.
          </ThemedText>
          <View style={styles.buttonWrapper}>
            <Button title="Sign In" onPress={handleLogin} fullWidth />
          </View>
        </View>
      </ThemedView>
    );
  }

  // Logged in - show accept view
  return (
    <ThemedView style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="fitness-center" size={64} color={Colors.dark.primary} />
        </View>
        <ThemedText style={styles.title}>Accept Invitation</ThemedText>
        <ThemedText style={styles.trainerName}>
          {invitation.trainerName}
        </ThemedText>
        {invitation.trainerBusiness && (
          <ThemedText style={styles.businessName}>
            {invitation.trainerBusiness}
          </ThemedText>
        )}
        <ThemedText style={styles.description}>
          wants to connect with you on Hoppa. Accept to receive personalized
          workout schemas.
        </ThemedText>

        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={16} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        <View style={styles.buttonWrapper}>
          <Button
            title={isAccepting ? 'Accepting...' : 'Accept Invitation'}
            onPress={handleAccept}
            loading={isAccepting}
            fullWidth
          />
        </View>
        <View style={styles.buttonWrapper}>
          <Button
            title="Decline"
            variant="ghost"
            onPress={handleGoHome}
            fullWidth
          />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginTop: 16,
  },
  iconContainer: {
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  trainerName: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.dark.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  businessName: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  signInPrompt: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  buttonWrapper: {
    width: '100%',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#EF4444' + '15',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
  },
});
