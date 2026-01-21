import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/contexts/subscription-context';
import { Colors } from '@/constants/theme';

type PlanType = 'monthly' | 'annual';

interface PlanOption {
  type: PlanType;
  title: string;
  price: string;
  period: string;
  savings?: string;
}

export default function PaywallScreen() {
  const router = useRouter();
  const {
    offerings,
    purchasePackage,
    restorePurchases,
    isLoading,
    error,
    clearError,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const monthlyPackage = offerings?.availablePackages.find(
    (pkg) => pkg.packageType === 'MONTHLY'
  );
  const annualPackage = offerings?.availablePackages.find(
    (pkg) => pkg.packageType === 'ANNUAL'
  );

  const plans: PlanOption[] = [
    {
      type: 'annual',
      title: 'Annual',
      price: annualPackage?.product.priceString ?? '€39.99',
      period: '/year',
      savings: 'Save 33%',
    },
    {
      type: 'monthly',
      title: 'Monthly',
      price: monthlyPackage?.product.priceString ?? '€4.99',
      period: '/month',
    },
  ];

  const features = [
    {
      title: 'Unlimited Workout Schemas',
      description: 'Create as many custom workout routines as you need',
    },
    {
      title: 'Advanced Progress Tracking',
      description: 'Detailed charts and analytics for all your lifts',
    },
    {
      title: 'AI Schema Import',
      description: 'Convert any workout plan to a Hoppa schema instantly',
    },
    {
      title: 'Cloud Sync',
      description: 'Access your workouts from any device',
    },
    {
      title: 'Priority Support',
      description: 'Get help when you need it',
    },
  ];

  const handleSelectPlan = (plan: PlanType) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    const pkg: PurchasesPackage | undefined =
      selectedPlan === 'annual' ? annualPackage : monthlyPackage;

    if (!pkg) {
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'This subscription plan is not available.');
      }
      return;
    }

    setIsPurchasing(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const success = await purchasePackage(pkg);
      if (success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.back();
      }
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const success = await restorePurchases();
      if (success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (Platform.OS !== 'web') {
          Alert.alert('Success', 'Your purchases have been restored.');
        }
        router.back();
      } else {
        if (Platform.OS !== 'web') {
          Alert.alert(
            'No Purchases Found',
            'We couldn\'t find any previous purchases to restore.'
          );
        }
      }
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  if (isLoading && !offerings) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <ThemedText style={styles.loadingText}>Loading plans...</ThemedText>
      </ThemedView>
    );
  }

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
            <ThemedText style={styles.iconText}>H</ThemedText>
          </View>
          <ThemedText style={styles.title}>Upgrade to Premium</ThemedText>
          <ThemedText style={styles.subtitle}>
            Unlock all features and take your training to the next level
          </ThemedText>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.checkmark}>
                <ThemedText style={styles.checkmarkText}>✓</ThemedText>
              </View>
              <View style={styles.featureContent}>
                <ThemedText style={styles.featureTitle}>
                  {feature.title}
                </ThemedText>
                <ThemedText style={styles.featureDescription}>
                  {feature.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* Plan Selection */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <Pressable
              key={plan.type}
              onPress={() => handleSelectPlan(plan.type)}
              style={[
                styles.planCard,
                selectedPlan === plan.type && styles.planCardSelected,
              ]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedPlan === plan.type && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedPlan === plan.type && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <ThemedText style={styles.planTitle}>{plan.title}</ThemedText>
                  {plan.savings && (
                    <View style={styles.savingsBadge}>
                      <ThemedText style={styles.savingsText}>
                        {plan.savings}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
                  <ThemedText style={styles.planPeriod}>{plan.period}</ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Error Message */}
        {error && (
          <Pressable onPress={clearError} style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <ThemedText style={styles.errorDismiss}>Tap to dismiss</ThemedText>
          </Pressable>
        )}

        {/* Purchase Button */}
        <Button
          title={isPurchasing ? 'Processing...' : 'Continue'}
          onPress={handlePurchase}
          loading={isPurchasing}
          disabled={isPurchasing || isRestoring}
          fullWidth
          size="lg"
        />

        {/* Restore Purchases */}
        <Pressable
          onPress={handleRestore}
          disabled={isRestoring || isPurchasing}
          style={styles.restoreButton}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
          ) : (
            <ThemedText style={styles.restoreText}>
              Restore Purchases
            </ThemedText>
          )}
        </Pressable>

        {/* Legal */}
        <ThemedText style={styles.legalText}>
          Payment will be charged to your Apple ID account at confirmation.
          Subscription automatically renews unless canceled at least 24 hours
          before the end of the current period. You can manage and cancel your
          subscription in your App Store account settings.
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
    marginBottom: 32,
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
  iconText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
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
  featuresContainer: {
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmarkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: Colors.dark.primary,
  },
  planHeader: {
    gap: 8,
  },
  planTitleRow: {
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
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  savingsBadge: {
    backgroundColor: Colors.dark.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 34,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginLeft: 2,
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.error,
    textAlign: 'center',
  },
  errorDismiss: {
    fontSize: 12,
    color: Colors.dark.error,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.8,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  legalText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.7,
  },
});
