import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

const features = [
  {
    icon: 'dumbbell.fill' as const,
    title: 'Smart Workout Tracking',
    description: 'Log your sets and reps with ease. Track every exercise in your routine.',
  },
  {
    icon: 'chart.line.uptrend.xyaxis' as const,
    title: 'Progressive Overload',
    description: 'Automatic weight progression recommendations based on your performance.',
  },
  {
    icon: 'calendar' as const,
    title: 'Workout History',
    description: 'Review your past workouts and track your progress over time.',
  },
  {
    icon: 'list.bullet.clipboard.fill' as const,
    title: 'Custom Schemas',
    description: 'Create personalized workout schemas that fit your training style.',
  },
];

function FeatureCard({ icon, title, description }: typeof features[0]) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconContainer}>
        {Platform.OS === 'ios' ? (
          <SymbolView name={icon} size={28} tintColor="#3B82F6" />
        ) : (
          <View style={styles.androidIconPlaceholder}>
            <ThemedText style={styles.androidIconText}>
              {icon === 'dumbbell.fill' ? '💪' :
               icon === 'chart.line.uptrend.xyaxis' ? '📈' :
               icon === 'calendar' ? '📅' : '📋'}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={styles.featureTitle}>{title}</ThemedText>
      <ThemedText style={styles.featureDescription}>{description}</ThemedText>
    </View>
  );
}

export default function LandingScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if already authenticated
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)/(home)" />;
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="figure.strengthtraining.traditional" size={64} tintColor="#3B82F6" />
            ) : (
              <ThemedText style={styles.logoEmoji}>🏋️</ThemedText>
            )}
          </View>
          <ThemedText type="title" style={styles.heroTitle}>
            Hoppa
          </ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Your personal workout companion for building strength and tracking progress.
          </ThemedText>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Everything you need to train smarter
          </ThemedText>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Link href="/auth/register" asChild>
            <Button
              title="Get Started"
              variant="primary"
              size="lg"
              fullWidth
            />
          </Link>
          <Link href="/auth/login" asChild>
            <Button
              title="Sign In"
              variant="secondary"
              size="lg"
              fullWidth
            />
          </Link>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Start your fitness journey today
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#3B82F620',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 56,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  featuresSection: {
    marginBottom: 48,
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 20,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3B82F620',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  androidIconPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidIconText: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  ctaSection: {
    gap: 12,
    marginBottom: 32,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
