import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export type TierType = 'starter' | 'pro' | 'studio';

export interface TierInfo {
  name: string;
  price: string;
  period: string;
  maxClients: number;
  features: string[];
  recommended?: boolean;
}

export const TIERS: Record<TierType, TierInfo> = {
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

interface TierCardProps {
  tierKey: TierType;
  tier: TierInfo;
  isSelected: boolean;
  isCurrentTier?: boolean;
  onSelect: (tier: TierType) => void;
  compact?: boolean;
}

function TierCard({
  tierKey,
  tier,
  isSelected,
  isCurrentTier,
  onSelect,
  compact,
}: TierCardProps) {
  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    onSelect(tierKey);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.tierCard,
        isSelected && styles.tierCardSelected,
        tier.recommended && styles.tierCardRecommended,
        compact && styles.tierCardCompact,
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

      {!compact && (
        <>
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
        </>
      )}

      {compact && (
        <View style={styles.compactFeatures}>
          <MaterialIcons name="people" size={14} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.compactFeatureText}>
            Up to {tier.maxClients} clients
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

interface TierSelectorProps {
  selectedTier: TierType;
  onSelectTier: (tier: TierType) => void;
  currentTier?: TierType;
  compact?: boolean;
  showStarterOnly?: boolean;
}

export function TierSelector({
  selectedTier,
  onSelectTier,
  currentTier,
  compact,
  showStarterOnly,
}: TierSelectorProps) {
  const tiersToShow = showStarterOnly
    ? (['starter'] as TierType[])
    : (['starter', 'pro', 'studio'] as TierType[]);

  return (
    <View style={styles.container}>
      {tiersToShow.map((tierKey) => (
        <TierCard
          key={tierKey}
          tierKey={tierKey}
          tier={TIERS[tierKey]}
          isSelected={selectedTier === tierKey}
          isCurrentTier={currentTier === tierKey}
          onSelect={onSelectTier}
          compact={compact}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
  tierCardCompact: {
    padding: 12,
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
  compactFeatures: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  compactFeatureText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
});
