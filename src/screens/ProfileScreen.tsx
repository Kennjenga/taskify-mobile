import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import api from '../services/api';
import { COLORS, SPACING, ROUNDED } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout, updateProfile, deleteAccount, isLoading } = useAuthStore();
  const { tasks } = useTaskStore();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isSendingDigest, setIsSendingDigest] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }

    const payload: any = { name: name.trim() };

    if (newPassword) {
      if (!currentPassword) {
        Alert.alert('Password Error', 'Please enter your current password to update credentials.');
        return;
      }
      if (newPassword.length < 8) {
        Alert.alert('Password Error', 'New password must be at least 8 characters long.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        Alert.alert('Password Error', 'New passwords do not match.');
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      await updateProfile(payload);
      Alert.alert('Success', 'Profile updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e: any) {
      Alert.alert('Update Error', e.message || 'Failed to update profile.');
    }
  };

  const handleSendEmailDigest = async () => {
    setIsSendingDigest(true);
    try {
      const response = await api.post('/api/user/email-digest');
      Alert.alert('Email Digest Sent', response.data.message || 'Digest sent successfully.');
    } catch (e: any) {
      Alert.alert('Email Digest Failed', e.response?.data?.error || 'Could not send digest.');
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Taskify?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    // If local account, we need current password to confirm deletion
    if (user?.authProvider === 'local') {
      Alert.prompt(
        'Confirm Account Deletion',
        'This action is permanent and will delete all tasks and account records. Please enter your password to confirm:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: async (password?: string) => {
              if (!password) {
                Alert.alert('Error', 'Password is required to delete account.');
                return;
              }
              try {
                await deleteAccount(password);
                Alert.alert('Account Deleted', 'Your account has been permanently removed.');
              } catch (e: any) {
                Alert.alert('Deletion Failed', e.message || 'Failed to delete account.');
              }
            },
          },
        ],
        'secure-text'
      );
    } else {
      // Social user bypass password prompt
      Alert.alert(
        'Confirm Account Deletion',
        'Are you sure you want to permanently delete your account and all associated tasks?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAccount();
                Alert.alert('Account Deleted', 'Your account has been permanently removed.');
              } catch (e: any) {
                Alert.alert('Deletion Failed', e.message || 'Failed to delete account.');
              }
            },
          },
        ]
      );
    }
  };

  const isLocalUser = user?.authProvider === 'local';
  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLetter}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.providerBadge}>
              Method: {user?.authProvider.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Action Panel */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Task Summary</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Outstanding Tasks:</Text>
            <Text style={styles.statsValue}>{pendingCount} pending</Text>
          </View>
          <TouchableOpacity
            style={[styles.digestButton, isSendingDigest && styles.disabledButton]}
            onPress={handleSendEmailDigest}
            disabled={isSendingDigest}
          >
            {isSendingDigest ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.digestButtonText}>📧 Email Task Digest</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Edit Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Update Personal Details</Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          {isLocalUser && (
            <>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Required for credentials update"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
              />

              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 8 chars, uppercase/numbers"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
              />

              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Repeat new password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.updateButton, isLoading && styles.disabledButton]}
            onPress={handleUpdateProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.updateButtonText}>Save Updates</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Danger Area */}
        <View style={[styles.sectionCard, styles.dangerCard]}>
          <Text style={[styles.sectionHeader, styles.dangerHeader]}>Danger Zone</Text>
          <Text style={styles.dangerSubText}>
            Wipe credentials, terminate session or purge all records permanently from databases.
          </Text>

          <View style={styles.dangerButtons}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: ROUNDED.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: ROUNDED.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    marginBottom: SPACING.md,
  },
  avatarLetter: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 32,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    marginTop: SPACING.md,
  },
  providerBadge: {
    fontSize: 11,
    color: COLORS.primaryLight,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderRadius: ROUNDED.xs,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: ROUNDED.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statsLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  statsValue: {
    color: COLORS.success,
    fontWeight: '600',
    fontSize: 15,
  },
  digestButton: {
    backgroundColor: COLORS.inputBg,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  digestButtonText: {
    color: COLORS.primaryLight,
    fontWeight: '600',
    fontSize: 15,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: ROUNDED.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  updateButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  dangerHeader: {
    color: COLORS.error,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  dangerSubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  dangerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoutButton: {
    flex: 0.47,
    backgroundColor: COLORS.inputBg,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  deleteButton: {
    flex: 0.47,
    backgroundColor: COLORS.error,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
});
