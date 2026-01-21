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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAction, useQuery } from 'convex/react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { api } from '@/convex/_generated/api';
import { Colors } from '@/constants/theme';

type TierType = 'starter' | 'pro' | 'studio';

interface TierInfo {
  name: string;
  price: string;
  period: string;
  maxClients: number;
  features: string[];
  recommended?: boolean;
}

const TIERS: Record<TierType, TierInfo> = {
  starter: {
    name: 'Starter',
    price: 'Free',
    period: '',
    maxClients: 3,
    features: [
      'Up to 3 clients',
      'Basic schema templates',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    price: '€29',
    period: '/month',
    maxClients: 30,
    features: [
      'Up to 30 clients',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
    ],
    recommended: true,
  },
  studio: {
    name: 'Studio',
    price: '€79',
    period: '/month',
    maxClients: 100,
    features: [
      'Up to 100 clients',
      'Team management',
      'API access',
      'Dedicated support',
      'White-label options',
    ],
  },
};

export default function TrainerSubscriptionScreen() {
  const router = useRouter();
  const trainer = useQuery(api.trainers.currentTrainer);
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const createBillingPortal = useAction(api.stripe.createBillingPortalSession);
  const subscriptionInfo = useAction(api.stripe.getSubscriptionInfo);

  const [selectedTier, setSelectedTier] = useState<TierType>('pro');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
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

  const handleSelectTier = (tier: TierType) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
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
          {(Object.entries(TIERS) as [TierType, TierInfo][]).map(([tierKey, tier]) => {
            const isCurrentTier = tierKey === currentTier;
            const isSelected = tierKey === selectedTier;

            return (
              <Pressable
                key={tierKey}
                onPress={() => handleSelectTier(tierKey)}
                style={[
                  styles.tierCard,
                  isSelected && styles.tierCardSelected,
                  tier.recommended && styles.tierCardRecommended,
                ]}
              >
                {tier.recommended && (
                  <View style={styles.recommendedBadge}>
                    <ThemedText style={styles.recommendedText}>RECOMMENDED</ThemedText>
                  </View>
                )}

                <View style={styles.tierHeader}>
                  <View style={styles.tierTitleRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <ThemedText style={styles.tierName}>{tier.name}</ThemedText>
                      {isCurrentTier && (
                        <ThemedText style={styles.currentLabel}>Current</ThemedText>
                      )}
                    </View>
                  </View>
                  <View style={styles.priceRow}>
                    <ThemedText style={styles.tierPrice}>{tier.price}</ThemedText>
                    {tier.period && (
                      <ThemedText style={styles.tierPeriod}>{tier.period}</ThemedText>
                    )}
                  </View>
                </View>

                <View style={styles.tierFeatures}>
                  {tier.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <MaterialIcons
                        name="check"
                        size={18}
                        color={Colors.dark.primary}
                      />
                      <ThemedText style={styles.featureText}>{feature}</ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.clientLimit}>
                  <MaterialIcons name="people" size={16} color={Colors.dark.textSecondary} />
                  <ThemedText style={styles.clientLimitText}>
                    {tier.maxClients} clients max
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
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
    gap: 16,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardSelected: {
    borderColor: Colors.dark.primary,
  },
  tierCardRecommended: {
    borderColor: Colors.dark.primary + '50',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.dark.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.primary,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '600',
  },
  currentLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tierPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  tierPeriod: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: 2,
  },
  tierFeatures: {
    gap: 8,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  clientLimit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  clientLimitText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
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
});
