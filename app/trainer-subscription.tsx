import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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

type ChangeType = 'upgrade' | 'downgrade' | 'downgrade-to-starter' | null;

export default function TrainerSubscriptionScreen() {
  const router = useRouter();
  const { success, canceled } = useLocalSearchParams<{ success?: string; canceled?: string }>();
  const trainer = useQuery(api.trainers.currentTrainer);
  const clientCount = useQuery(api.trainers.getClientCount);
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const createBillingPortal = useAction(api.stripe.createBillingPortalSession);
  const subscriptionInfo = useAction(api.stripe.getSubscriptionInfo);
  const changeSubscription = useAction(api.stripe.changeSubscription);
  const downgradeToStarter = useAction(api.stripe.downgradeToStarter);
  const resumeSubscription = useAction(api.stripe.resumeSubscription);

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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    type: ChangeType;
    tier: TierType;
  } | null>(null);
  const [isChanging, setIsChanging] = useState(false);

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

  // Determine what type of change this is
  const getChangeType = (fromTier: TierType, toTier: TierType): ChangeType => {
    if (fromTier === toTier) return null;
    if (toTier === 'starter') return 'downgrade-to-starter';

    const tierOrder = { starter: 0, pro: 1, studio: 2 };
    return tierOrder[toTier] > tierOrder[fromTier] ? 'upgrade' : 'downgrade';
  };

  // Check if downgrade would exceed client limit
  const wouldExceedClientLimit = (newTier: TierType): boolean => {
    if (!clientCount) return false;
    const newMaxClients = TIERS[newTier].maxClients;
    return clientCount.active > newMaxClients;
  };

  const handleTierChange = () => {
    if (selectedTier === trainer?.subscriptionTier) {
      if (Platform.OS !== 'web') {
        Alert.alert('Already Subscribed', `You are already on the ${TIERS[selectedTier].name} plan.`);
      }
      return;
    }

    const currentTier = trainer?.subscriptionTier as TierType || 'starter';
    const changeType = getChangeType(currentTier, selectedTier);

    if (!changeType) return;

    // Check client limit for downgrades
    if ((changeType === 'downgrade' || changeType === 'downgrade-to-starter') && wouldExceedClientLimit(selectedTier)) {
      const exceededBy = (clientCount?.active || 0) - TIERS[selectedTier].maxClients;
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Cannot Downgrade',
          `You have ${clientCount?.active} active clients but the ${TIERS[selectedTier].name} plan only allows ${TIERS[selectedTier].maxClients}. Please remove ${exceededBy} client${exceededBy === 1 ? '' : 's'} before downgrading.`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    // For new subscriptions (from starter), go directly to checkout
    if (currentTier === 'starter' && selectedTier !== 'starter') {
      handleNewSubscription();
      return;
    }

    // Show confirmation modal for changes
    setPendingChange({ type: changeType, tier: selectedTier });
    setShowConfirmModal(true);
  };

  const handleNewSubscription = async () => {
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

  const handleConfirmChange = async () => {
    if (!pendingChange) return;

    setIsChanging(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      if (pendingChange.type === 'downgrade-to-starter') {
        const result = await downgradeToStarter();
        if (result.success) {
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          if (Platform.OS !== 'web') {
            Alert.alert(
              'Subscription Canceled',
              `Your subscription will end on ${new Date(result.endDate * 1000).toLocaleDateString()}. You'll be downgraded to the Starter plan after that.`
            );
          }
          await loadSubscriptionInfo();
        }
      } else if (pendingChange.type === 'upgrade' || pendingChange.type === 'downgrade') {
        const result = await changeSubscription({
          newTier: pendingChange.tier as 'pro' | 'studio',
        });
        if (result.success) {
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          if (Platform.OS !== 'web') {
            Alert.alert(
              pendingChange.type === 'upgrade' ? 'Upgraded!' : 'Plan Changed',
              result.message
            );
          }
          await loadSubscriptionInfo();
        }
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const message = error instanceof Error ? error.message : 'Failed to change subscription';
      if (Platform.OS !== 'web') {
        Alert.alert('Error', message);
      }
    } finally {
      setIsChanging(false);
      setShowConfirmModal(false);
      setPendingChange(null);
    }
  };

  const handleResumeSubscription = async () => {
    setIsLoading(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await resumeSubscription();
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (Platform.OS !== 'web') {
        Alert.alert('Subscription Resumed', 'Your subscription will continue as normal.');
      }
      await loadSubscriptionInfo();
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const message = error instanceof Error ? error.message : 'Failed to resume subscription';
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

        {/* Action Button */}
        {selectedTier !== currentTier && (
          <Button
            title={
              isLoading
                ? 'Processing...'
                : selectedTier === 'starter'
                  ? 'Downgrade to Starter'
                  : currentTier === 'starter'
                    ? `Subscribe to ${TIERS[selectedTier].name}`
                    : getChangeType(currentTier, selectedTier) === 'upgrade'
                      ? `Upgrade to ${TIERS[selectedTier].name}`
                      : `Downgrade to ${TIERS[selectedTier].name}`
            }
            onPress={handleTierChange}
            loading={isLoading}
            disabled={isLoading || isLoadingPortal || isChanging}
            fullWidth
            size="lg"
            variant={
              selectedTier === 'starter' ||
              (currentTier !== 'starter' && getChangeType(currentTier, selectedTier) === 'downgrade')
                ? 'secondary'
                : 'primary'
            }
          />
        )}

        {/* Resume Subscription Button */}
        {willCancel && !isCanceled && (
          <View style={styles.resumeButton}>
            <Button
              title={isLoading ? 'Processing...' : 'Keep My Subscription'}
              onPress={handleResumeSubscription}
              loading={isLoading}
              disabled={isLoading || isLoadingPortal || isChanging}
              fullWidth
              size="lg"
            />
          </View>
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
          portal. Upgrades take effect immediately with prorated billing.
        </ThemedText>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmModal(false);
          setPendingChange(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons
                name={
                  pendingChange?.type === 'upgrade'
                    ? 'trending-up'
                    : pendingChange?.type === 'downgrade-to-starter'
                      ? 'cancel'
                      : 'trending-down'
                }
                size={32}
                color={
                  pendingChange?.type === 'upgrade'
                    ? '#10B981'
                    : '#F59E0B'
                }
              />
              <ThemedText style={styles.modalTitle}>
                {pendingChange?.type === 'upgrade'
                  ? 'Upgrade Plan'
                  : pendingChange?.type === 'downgrade-to-starter'
                    ? 'Cancel Subscription'
                    : 'Downgrade Plan'}
              </ThemedText>
            </View>

            <ThemedText style={styles.modalText}>
              {pendingChange?.type === 'upgrade' && (
                <>
                  {"You're upgrading to "}<ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].name}</ThemedText>.
                  {'\n\n'}
                  {"You'll be charged a prorated amount for the remainder of your billing cycle, then "}
                  <ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].price}{TIERS[pendingChange.tier].period}</ThemedText>{' '}
                  starting next billing cycle.
                  {'\n\n'}
                  Your client limit will increase to <ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].maxClients}</ThemedText> immediately.
                </>
              )}
              {pendingChange?.type === 'downgrade' && (
                <>
                  {"You're downgrading to "}<ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].name}</ThemedText>.
                  {'\n\n'}
                  Your current plan will remain active until the end of your billing period.
                  {"Then you'll be billed "}
                  <ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].price}{TIERS[pendingChange.tier].period}</ThemedText>.
                  {'\n\n'}
                  Your client limit will change to <ThemedText style={styles.modalBold}>{TIERS[pendingChange.tier].maxClients}</ThemedText>.
                </>
              )}
              {pendingChange?.type === 'downgrade-to-starter' && (
                <>
                  {"You're canceling your subscription."}
                  {'\n\n'}
                  Your current plan will remain active until the end of your billing period.
                  {"After that, you'll be on the free "}<ThemedText style={styles.modalBold}>Starter</ThemedText> plan.
                  {'\n\n'}
                  Your client limit will be reduced to <ThemedText style={styles.modalBold}>3</ThemedText>.
                  {clientCount && clientCount.active > 3 && (
                    <>
                      {'\n\n'}
                      <ThemedText style={styles.modalWarning}>
                        {"Warning: You currently have "}{clientCount.active}{" active clients. "}
                        {"You'll need to reduce to 3 clients before the subscription ends."}
                      </ThemedText>
                    </>
                  )}
                </>
              )}
            </ThemedText>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowConfirmModal(false);
                  setPendingChange(null);
                }}
                style={styles.modalCancelButton}
                disabled={isChanging}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>

              <Pressable
                onPress={handleConfirmChange}
                style={[
                  styles.modalConfirmButton,
                  pendingChange?.type !== 'upgrade' && styles.modalConfirmButtonWarning,
                ]}
                disabled={isChanging}
              >
                {isChanging ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.modalConfirmText}>
                    {pendingChange?.type === 'upgrade'
                      ? 'Upgrade Now'
                      : pendingChange?.type === 'downgrade-to-starter'
                        ? 'Cancel Subscription'
                        : 'Confirm Downgrade'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  resumeButton: {
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalBold: {
    fontWeight: '600',
    color: Colors.dark.text,
  },
  modalWarning: {
    color: '#F59E0B',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmButtonWarning: {
    backgroundColor: '#F59E0B',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
