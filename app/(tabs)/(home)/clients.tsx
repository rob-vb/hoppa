import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useAction, useMutation } from 'convex/react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ClientCard, type ClientStatus } from '@/components/ui/client-card';
import { InviteClientModal } from '@/components/ui/invite-client-modal';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

type FilterStatus = 'all' | ClientStatus;

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'invited' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
];

export default function ClientsScreen() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const trainer = useQuery(api.trainers.currentTrainer);
  const clientCount = useQuery(api.trainers.getClientCount);
  const clients = useQuery(api.trainers.getClientsWithActivity, {});

  const sendInvitation = useAction(api.clientInvitations.sendInvitation);
  const resendInvitation = useAction(api.clientInvitations.resendInvitation);
  const cancelInvitation = useMutation(api.clientInvitations.cancelInvitation);
  const updateStatus = useMutation(api.clientInvitations.updateClientStatus);

  const filteredClients = clients?.filter((client) => {
    if (filterStatus === 'all') return true;
    return client.status === filterStatus;
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Queries will auto-refresh, just simulate a delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Queries will auto-refresh on focus
    }, [])
  );

  const handleFilterChange = (status: FilterStatus) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    setFilterStatus(status);
  };

  const handleInvite = async (email: string, name?: string, notes?: string) => {
    const result = await sendInvitation({ clientEmail: email, clientName: name, notes });
    return result;
  };

  const handleResendInvite = async (invitationId: Id<'trainerClients'>) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const result = await resendInvitation({ invitationId });
      if (result.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Success', 'Invitation resent successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to resend invitation');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCancelInvite = (invitationId: Id<'trainerClients'>, email: string) => {
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation to ${email}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            try {
              await cancelInvitation({ invitationId });
            } catch {
              Alert.alert('Error', 'Failed to cancel invitation');
            }
          },
        },
      ]
    );
  };

  const handleClientPress = (client: typeof clients extends (infer T)[] | undefined ? T : never) => {
    if (!client) return;

    if (client.status === 'invited') {
      // Show options for pending invitation
      Alert.alert(client.clientEmail, 'What would you like to do?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resend Invitation',
          onPress: () => handleResendInvite(client._id),
        },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: () => handleCancelInvite(client._id, client.clientEmail),
        },
      ]);
    } else {
      // Show status options for active clients
      const statusOptions: { text: string; status?: 'active' | 'paused' | 'archived' }[] = [];

      if (client.status !== 'active') {
        statusOptions.push({ text: 'Set Active', status: 'active' });
      }
      if (client.status !== 'paused') {
        statusOptions.push({ text: 'Pause', status: 'paused' });
      }
      if (client.status !== 'archived') {
        statusOptions.push({ text: 'Archive', status: 'archived' });
      }

      Alert.alert(
        client.user?.name || client.clientEmail,
        'Manage client status',
        [
          { text: 'Cancel', style: 'cancel' },
          ...statusOptions.map((option) => ({
            text: option.text,
            onPress: async () => {
              if (option.status) {
                try {
                  await updateStatus({
                    clientId: client._id,
                    status: option.status,
                  });
                  if (Platform.OS === 'ios') {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                  }
                } catch {
                  Alert.alert('Error', 'Failed to update client status');
                }
              }
            },
          })),
        ]
      );
    }
  };

  if (!trainer) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            You need to be registered as a trainer to manage clients.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statValue}>
            {clientCount?.active ?? 0}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Active</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <ThemedText style={styles.statValue}>
            {clients?.filter((c) => c.status === 'invited').length ?? 0}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Pending</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <ThemedText style={styles.statValue}>
            {trainer.maxClients - (clientCount?.active ?? 0)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Available</ThemedText>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleFilterChange(item.value)}
              style={[
                styles.filterButton,
                filterStatus === item.value && styles.filterButtonActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  filterStatus === item.value && styles.filterTextActive,
                ]}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>

      {/* Client List */}
      {!clients ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      ) : filteredClients && filteredClients.length > 0 ? (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.dark.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ClientCard
              email={item.clientEmail}
              name={item.user?.name}
              status={item.status}
              invitedAt={item.invitedAt}
              acceptedAt={item.acceptedAt}
              lastWorkout={item.lastWorkout}
              totalWorkouts={item.totalWorkouts}
              workoutsThisWeek={item.workoutsThisWeek}
              onPress={() => handleClientPress(item)}
              onResendInvite={
                item.status === 'invited'
                  ? () => handleResendInvite(item._id)
                  : undefined
              }
              onCancelInvite={
                item.status === 'invited'
                  ? () => handleCancelInvite(item._id, item.clientEmail)
                  : undefined
              }
            />
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons
            name="people-outline"
            size={64}
            color={Colors.dark.textSecondary}
          />
          <ThemedText style={styles.emptyTitle}>No clients yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            {filterStatus === 'all'
              ? 'Invite your first client to get started'
              : `No ${filterStatus} clients`}
          </ThemedText>
          {filterStatus === 'all' && (
            <View style={styles.emptyButton}>
              <Button
                title="Invite Client"
                onPress={() => setIsInviteModalVisible(true)}
              />
            </View>
          )}
        </View>
      )}

      {/* Floating Action Button */}
      {clients && clients.length > 0 && (
        <Pressable
          onPress={() => {
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            setIsInviteModalVisible(true);
          }}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <MaterialIcons name="person-add" size={24} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Invite Modal */}
      <InviteClientModal
        visible={isInviteModalVisible}
        onClose={() => setIsInviteModalVisible(false)}
        onInvite={handleInvite}
        clientCount={clientCount?.active ?? 0}
        maxClients={trainer.maxClients}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginVertical: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  filterContainer: {
    marginTop: 16,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
