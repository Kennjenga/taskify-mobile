import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useTaskStore, Task } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { COLORS, SPACING, ROUNDED } from '../utils/theme';
import { registerForPushNotificationsAsync, scheduleTaskReminder, cancelTaskReminder } from '../services/notification';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const formatDateToInput = (dateInput?: string | Date | null) => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

export default function DashboardScreen({ navigation }: Props) {
  const { user } = useAuthStore();
  const {
    tasks,
    isLoading,
    isOffline,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
  } = useTaskStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    fetchTasks();
    registerForPushNotificationsAsync();
  }, []);

  const openAddModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(12, 0, 0, 0); // Default to tomorrow at 12:00 PM
    setDueDate(formatDateToInput(tomorrow));
    setModalVisible(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setDueDate(formatDateToInput(task.dueDate));
    setModalVisible(true);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }

    let formattedDueDate: string | null = null;
    if (dueDate.trim()) {
      const parsedDate = new Date(dueDate.trim().replace(' ', 'T'));
      const finalDate = isNaN(parsedDate.getTime()) ? new Date(dueDate.trim()) : parsedDate;
      if (isNaN(finalDate.getTime())) {
        Alert.alert('Validation Error', 'Please enter a valid date and time in YYYY-MM-DD HH:MM format.');
        return;
      }
      formattedDueDate = finalDate.toISOString();
    }

    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: title.trim(),
          description: description.trim(),
          dueDate: formattedDueDate,
        });

        // Reschedule local reminder if not completed
        if (!editingTask.completed && formattedDueDate) {
          await scheduleTaskReminder(editingTask.id, title.trim(), formattedDueDate);
        } else {
          await cancelTaskReminder(editingTask.id);
        }
      } else {
        // Create new task
        // Get temp ID if offline, otherwise server generates it.
        // Zustand store manages this.
        await createTask(title.trim(), description.trim(), formattedDueDate);

        // Find the newly created task (first in list)
        const newestTask = useTaskStore.getState().tasks[0];
        if (newestTask && formattedDueDate) {
          await scheduleTaskReminder(newestTask.id, newestTask.title, formattedDueDate);
        }
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error Saving Task', e.message || 'Something went wrong.');
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      await toggleTaskCompletion(task.id);
      if (!task.completed) {
        // If it was pending and is now completed, cancel the push notification
        await cancelTaskReminder(task.id);
      } else {
        // If it was completed and is now pending, reschedule if there's a future due date
        if (task.dueDate) {
          await scheduleTaskReminder(task.id, task.title, task.dueDate);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update task status.');
    }
  };

  const handleDelete = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            await cancelTaskReminder(task.id);
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete task.');
          }
        },
      },
    ]);
  };

  const renderTaskItem = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => openEditModal(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.8}
    >
      <View style={styles.taskCardContent}>
        <TouchableOpacity
          style={[styles.checkbox, item.completed && styles.checkboxChecked]}
          onPress={() => handleToggle(item)}
        >
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <View style={styles.taskDetails}>
          <Text style={[styles.taskTitle, item.completed && styles.taskTitleCompleted]}>
            {item.title}
          </Text>
          {!!item.description && (
            <Text
              style={[styles.taskDesc, item.completed && styles.taskDescCompleted]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
          {item.dueDate && (
            <Text style={styles.taskDueDate}>
              📅 Due: {new Date(item.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const sections = [
    { title: 'Pending Tasks', data: pendingTasks, completed: false },
    { title: 'Completed Tasks', data: completedTasks, completed: true },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
          <Text style={styles.headerSub}>Manage your schedule today</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            ⚠️ Offline Mode: Changes are stored locally & will sync when online.
          </Text>
        </View>
      )}

      {isLoading && tasks.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching tasks...</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Tasks Found</Text>
          <Text style={styles.emptySub}>Tap the button below to add your first task!</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer}>
          {sections.map((section) => {
            if (section.data.length === 0) return null;
            return (
              <View key={section.title} style={styles.sectionContainer}>
                <Text style={styles.sectionHeader}>
                  {section.title} ({section.data.length})
                </Text>
                {section.data.map((item) => (
                  <View key={item.id}>{renderTaskItem({ item })}</View>
                ))}
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add / Edit Task Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTask ? 'Edit Task' : 'New Task'}
            </Text>

            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Build Mobile UI"
              placeholderTextColor={COLORS.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              placeholder="Add task notes here..."
              placeholderTextColor={COLORS.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Due Date & Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2026-06-25 15:30"
              placeholderTextColor={COLORS.textSecondary}
              value={dueDate}
              onChangeText={setDueDate}
            />

            <View style={styles.quickDateContainer}>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  setDueDate(formatDateToInput(today));
                }}
              >
                <Text style={styles.quickDateText}>Today 12:00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                  tomorrow.setHours(12, 0, 0, 0);
                  setDueDate(formatDateToInput(tomorrow));
                }}
              >
                <Text style={styles.quickDateText}>Tomorrow 12:00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  nextWeek.setHours(12, 0, 0, 0);
                  setDueDate(formatDateToInput(nextWeek));
                }}
              >
                <Text style={styles.quickDateText}>Next Week 12:00</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveTask}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Nested scroll helper
import { ScrollView } from 'react-native-gesture-handler';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avatarButton: {
    borderRadius: ROUNDED.full,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: ROUNDED.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  avatarLetter: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 18,
  },
  offlineBanner: {
    backgroundColor: COLORS.warning,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  offlineText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  sectionContainer: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskCard: {
    backgroundColor: COLORS.card,
    borderRadius: ROUNDED.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.9,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: ROUNDED.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  taskTitleCompleted: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  taskDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  taskDescCompleted: {
    color: 'rgba(156, 163, 175, 0.5)',
    textDecorationLine: 'line-through',
  },
  taskDueDate: {
    fontSize: 12,
    color: COLORS.primaryLight,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: 18,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: ROUNDED.full,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabText: {
    color: COLORS.white,
    fontSize: 32,
    lineHeight: 32,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: ROUNDED.lg,
    borderTopRightRadius: ROUNDED.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: ROUNDED.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  modalInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  quickDateContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  quickDateButton: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ROUNDED.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: SPACING.sm,
  },
  quickDateText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
  },
  modalButton: {
    flex: 0.47,
    paddingVertical: SPACING.md,
    borderRadius: ROUNDED.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonSave: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
});
