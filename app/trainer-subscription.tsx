import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAction, useQuery } from 'convex/react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TierSelector, TIERS, type TierType } from '@/components/ui/tier-selector';
import { api } from '@/convex/_generated/api';
import { Colors } from '@/constants/theme';

export default function TrainerSubscriptionScreen() {
  const router = useRouter();
  const { success, canceled } = useLocalSearchParams<{ success?: string; canceled?: string }>();
  const trainer = useQuery(api.trainers.currentTrainer);
  const clientCount = useQuery(api.trainers.getClientCount);
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const createBillingPortal = useAction(api.stripe.createBillingPortalSession);
  const subscriptionInfo = useAction(api.stripe.getSubscriptionInfo);

  const [selectedTier, setSelectedTier] = useState<TierType>('starter');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showCanceledMessage, setShowCanceledMessage] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<{
    tier: string;
    status: string;
    subscription?: {
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    };
  } | null>(null);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      const info = await subscriptionInfo();
      if (info) {
        setCurrentSubscription(info);
      }
    } catch {
      // Subscription info not available
    }
  }, [subscriptionInfo]);

  useEffect(() => {
    if (trainer) {
      setSelectedTier(trainer.subscriptionTier);
      loadSubscriptionInfo();
    }
  }, [trainer, loadSubscriptionInfo]);

  // Handle success/canceled URL params
  useEffect(() => {
    if (success === 'true') {
      setShowSuccessMessage(true);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Refresh subscription info after successful checkout
      loadSubscriptionInfo();
    } else if (canceled === 'true') {
      setShowCanceledMessage(true);
    }
  }, [success, canceled, loadSubscriptionInfo]);

  const dismissSuccessMessage = () => {
    setShowSuccessMessage(false);
    // Clear URL params
    router.setParams({ success: undefined, canceled: undefined });
  };

  const dismissCanceledMessage = () => {
    setShowCanceledMessage(false);
    // Clear URL params
    router.setParams({ success: undefined, canceled: undefined });
  };

  const handleSelectTier = (tier: TierType) => {
    setSelectedTier(tier);
  };

  const handleSubscribe = async () => {
    if (selectedTier === 'starter') {
      // Starter is free, just close
      router.back();
      return;
    }

    if (selectedTier === trainer?.subscriptionTier) {
      // Already on this tier
      if (Platform.OS !== 'web') {
        Alert.alert('Already Subscribed', `You are already on the ${TIERS[selectedTier].name} plan.`);
      }
      return;
    }

    setIsLoading(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const baseUrl = Platform.OS === 'web'
        ? window.location.origin
        : 'hoppa://';

      const { url } = await createCheckoutSession({
        tier: selectedTier as 'pro' | 'studio',
        successUrl: `${baseUrl}/trainer-subscription?success=true`,
        cancelUrl: `${baseUrl}/trainer-subscription?canceled=true`,
      });

      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const message = error instanceof Error ? error.message : 'Failed to start checkout';
      if (Platform.OS !== 'web') {
        Alert.alert('Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const baseUrl = Platform.OS === 'web'
        ? window.location.origin
        : 'hoppa://';

      const { url } = await createBillingPortal({
        returnUrl: `${baseUrl}/trainer-subscription`,
      });

      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const message = error instanceof Error ? error.message : 'Failed to open billing portal';
      if (Platform.OS !== 'web') {
        Alert.alert('Error', message);
      }
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  if (!trainer) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const currentTier = trainer.subscriptionTier as TierType;
  const hasActiveSubscription = currentTier !== 'starter' && trainer.subscriptionStatus === 'active';
  const isPastDue = trainer.subscriptionStatus === 'past_due';
  const isCanceled = trainer.subscriptionStatus === 'canceled';
  const willCancel = currentSubscription?.subscription?.cancelAtPeriodEnd;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Close Button */}
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ThemedText style={styles.closeButtonText}>Close</ThemedText>
        </Pressable>

        {/* Success Message */}
        {showSuccessMessage && (
          <Pressable onPress={dismissSuccessMessage} style={styles.successBanner}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
            <View style={styles.bannerContent}>
              <ThemedText style={styles.successTitle}>Subscription Activated!</ThemedText>
              <ThemedText style={styles.successText}>
                Welcome to {trainer.subscriptionTier === 'pro' ? 'Pro' : 'Studio'}. Your plan is now active.
              </ThemedText>
            </View>
            <MaterialIcons name="close" size={18} color={Colors.dark.textSecondary} />
          </Pressable>
        )}

        {/* Canceled Message */}
        {showCanceledMessage && (
          <Pressable onPress={dismissCanceledMessage} style={styles.canceledBanner}>
            <MaterialIcons name="info" size={20} color={Colors.dark.primary} />
            <View style={styles.bannerContent}>
              <ThemedText style={styles.canceledTitle}>Checkout Canceled</ThemedText>
              <ThemedText style={styles.canceledText}>
                No changes were made to your subscription.
              </ThemedText>
            </View>
            <MaterialIcons name="close" size={18} color={Colors.dark.textSecondary} />
          </Pressable>
        )}

        {/* Past Due Warning */}
        {isPastDue && (
          <View style={styles.warningBanner}>
            <MaterialIcons name="warning" size={20} color="#EF4444" />
            <View style={styles.bannerContent}>
              <ThemedText style={styles.warningTitle}>Payment Past Due</ThemedText>
              <ThemedText style={styles.warningText}>
                Please update your payment method to avoid service interruption.
              </ThemedText>
            </View>
          </View>
        )}

        {/* Cancellation Notice */}
        {willCancel && !isCanceled && (
          <View style={styles.noticeBanner}>
            <MaterialIcons name="schedule" size={20} color="#F59E0B" />
            <View style={styles.bannerContent}>
              <ThemedText style={styles.noticeTitle}>Subscription Ending</ThemedText>
              <ThemedText style={styles.noticeText}>
                Your subscription will end on{' '}
                {new Date(currentSubscription.subscription!.currentPeriodEnd * 1000).toLocaleDateString()}.
              </ThemedText>
            </View>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="star" size={36} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.title}>Trainer Subscription</ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose the plan that fits your training business
          </ThemedText>
        </View>

        {/* Client Count */}
        {clientCount && (
          <View style={styles.clientCountCard}>
            <MaterialIcons name="people" size={24} color={Colors.dark.primary} />
            <View style={styles.clientCountInfo}>
              <ThemedText style={styles.clientCountValue}>
                {clientCount.active} / {clientCount.maxClients}
              </ThemedText>
              <ThemedText style={styles.clientCountLabel}>Active Clients</ThemedText>
            </View>
            {clientCount.active >= clientCount.maxClients && (
              <View style={styles.limitBadge}>
                <ThemedText style={styles.limitBadgeText}>At Limit</ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Current Plan Badge */}
        {hasActiveSubscription && (
          <View style={styles.currentPlanBadge}>
            <MaterialIcons name="check-circle" size={18} color="#10B981" />
            <ThemedText style={styles.currentPlanText}>
              Current plan: {TIERS[currentTier].name}
            </ThemedText>
          </View>
        )}

        {/* Tier Cards */}
        <View style={styles.tiersContainer}>
          <TierSelector
            selectedTier={selectedTier}
            onSelectTier={handleSelectTier}
            currentTier={currentTier}
          />
        </View>

        {/* Subscribe Button */}
        {selectedTier !== 'starter' && selectedTier !== currentTier && (
          <Button
            title={isLoading ? 'Processing...' : `Subscribe to ${TIERS[selectedTier].name}`}
            onPress={handleSubscribe}
            loading={isLoading}
            disabled={isLoading || isLoadingPortal}
            fullWidth
            size="lg"
          />
        )}

        {/* Manage Subscription Button */}
        {hasActiveSubscription && (
          <Pressable
            onPress={handleManageSubscription}
            disabled={isLoadingPortal || isLoading}
            style={styles.manageButton}
          >
            {isLoadingPortal ? (
              <ActivityIndicator size="small" color={Colors.dark.primary} />
            ) : (
              <ThemedText style={styles.manageButtonText}>
                Manage Subscription
              </ThemedText>
            )}
          </Pressable>
        )}

        {/* Subscription Info */}
        {currentSubscription?.subscription && (
          <View style={styles.subscriptionInfo}>
            <ThemedText style={styles.subscriptionInfoText}>
              {currentSubscription.subscription.cancelAtPeriodEnd
                ? 'Subscription ends on '
                : 'Next billing date: '}
              {new Date(currentSubscription.subscription.currentPeriodEnd * 1000).toLocaleDateString()}
            </ThemedText>
          </View>
        )}

        {/* Legal */}
        <ThemedText style={styles.legalText}>
          Subscriptions are billed monthly. You can cancel anytime from the billing
          portal. Changes take effect immediately.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981' + '20',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  currentPlanText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  tiersContainer: {
    marginBottom: 24,
  },
  manageButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  manageButtonText: {
    fontSize: 16,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  subscriptionInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionInfoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  legalText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.7,
    marginTop: 8,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '20',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 12,
  },
  bannerContent: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  successText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  canceledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 12,
  },
  canceledTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  canceledText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444' + '20',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 12,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  warningText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B' + '20',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 12,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  noticeText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  clientCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 14,
  },
  clientCountInfo: {
    flex: 1,
  },
  clientCountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  clientCountLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  limitBadge: {
    backgroundColor: '#F59E0B' + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  limitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
});
