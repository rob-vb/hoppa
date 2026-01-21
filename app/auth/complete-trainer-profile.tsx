import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAction } from 'convex/react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { TierSelector, type TierType } from '@/components/ui/tier-selector';
import { api } from '@/convex/_generated/api';

export default function CompleteTrainerProfileScreen() {
  const { registerAsTrainer, user } = useAuth();
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedTier, setSelectedTier] = useState<TierType>('starter');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const result = await registerAsTrainer(businessName || undefined, bio || undefined, selectedTier);

      // If paid tier selected, redirect to Stripe checkout
      if (result.requiresPayment) {
        const baseUrl = Platform.OS === 'web'
          ? window.location.origin
          : 'hoppa://';

        const { url } = await createCheckoutSession({
          tier: result.tier as 'pro' | 'studio',
          successUrl: `${baseUrl}/trainer-subscription?success=true`,
          cancelUrl: `${baseUrl}/trainer-subscription?canceled=true`,
        });

        if (Platform.OS === 'web') {
          window.location.href = url;
        } else {
          await Linking.openURL(url);
        }
      } else {
        // Navigation will be handled automatically by auth state change
        router.replace('/(tabs)/(home)');
      }
    } catch {
      setError('Failed to complete trainer registration. Please try again.');
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // User can skip and complete profile later
    router.replace('/(tabs)/(home)');
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Complete Your Profile
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {user?.name ? `Welcome, ${user.name}! ` : ''}Add some details about your training business
            </ThemedText>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Business Name (optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., FitCoach Training"
                placeholderTextColor="#6B7280"
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Bio (optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell clients about your training experience and specialties..."
                placeholderTextColor="#6B7280"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.tierSection}>
              <ThemedText style={styles.tierSectionTitle}>Choose Your Plan</ThemedText>
              <TierSelector
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
                compact
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Complete Registration</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isSubmitting}
            >
              <ThemedText style={styles.skipButtonText}>Skip for now</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
  },
  form: {
    gap: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  tierSection: {
    gap: 12,
  },
  tierSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
