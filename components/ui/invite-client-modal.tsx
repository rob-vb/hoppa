import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';

interface InviteClientModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (
    email: string,
    name?: string,
    notes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  clientCount: number;
  maxClients: number;
}

export function InviteClientModal({
  visible,
  onClose,
  onInvite,
  clientCount,
  maxClients,
}: InviteClientModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canInvite = clientCount < maxClients;

  const handleClose = () => {
    if (isLoading) return;
    setEmail('');
    setName('');
    setNotes('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInvite = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsLoading(true);

    try {
      const result = await onInvite(
        email.trim(),
        name.trim() || undefined,
        notes.trim() || undefined
      );

      if (result.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setSuccess(true);
        // Auto close after showing success
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setError(result.error || 'Failed to send invitation');
      }
    } catch {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="close" size={24} color={Colors.dark.text} />
          </Pressable>
          <ThemedText style={styles.title}>Invite Client</ThemedText>
          <View style={styles.placeholder} />
        </View>

        {success ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <MaterialIcons name="check-circle" size={64} color="#10B981" />
            </View>
            <ThemedText style={styles.successTitle}>Invitation Sent!</ThemedText>
            <ThemedText style={styles.successText}>
              An email has been sent to {email}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.content}>
            {!canInvite && (
              <View style={styles.limitWarning}>
                <MaterialIcons name="warning" size={20} color="#F59E0B" />
                <ThemedText style={styles.limitWarningText}>
                  You&apos;ve reached your client limit ({maxClients}). Upgrade your
                  plan to invite more clients.
                </ThemedText>
              </View>
            )}

            <View style={styles.clientCount}>
              <ThemedText style={styles.clientCountText}>
                {clientCount} / {maxClients} clients
              </ThemedText>
            </View>

            <Input
              label="Email *"
              placeholder="client@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={canInvite && !isLoading}
            />

            <View style={styles.spacing} />

            <Input
              label="Name (optional)"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={canInvite && !isLoading}
            />

            <View style={styles.spacing} />

            <Input
              label="Personal message (optional)"
              placeholder="Looking forward to training with you!"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.notesInput}
              editable={canInvite && !isLoading}
            />

            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error" size={16} color="#EF4444" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            <View style={styles.actions}>
              <Button
                title={isLoading ? 'Sending...' : 'Send Invitation'}
                onPress={handleInvite}
                disabled={!canInvite || isLoading}
                loading={isLoading}
                fullWidth
              />
            </View>

            <ThemedText style={styles.hint}>
              The client will receive an email with a link to join your training
              program.
            </ThemedText>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    padding: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F59E0B' + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#F59E0B',
    lineHeight: 20,
  },
  clientCount: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  clientCountText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  spacing: {
    height: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EF4444' + '15',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
  },
  actions: {
    marginTop: 24,
  },
  hint: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
});
