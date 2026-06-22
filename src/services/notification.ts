import { Platform, Alert } from 'react-native';
import { isRunningInExpoGo } from 'expo';

// Only load expo-notifications if NOT running inside Expo Go,
// as Expo Go (SDK 53+) throws an error on import/init.
const isExpoGo = isRunningInExpoGo();
let Notifications: any = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.error('Failed to load expo-notifications:', e);
  }
}

// Configure notification behavior for when the app is in the foreground
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Active timeouts map for simulation mode
const simulatedTimers = new Map<string, any>();

/**
 * Request user permissions for local push notifications
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Notifications) {
    console.warn('Notifications functionality is disabled in Expo Go. Operating in alert simulation mode.');
    return true; // Proceed in simulation mode
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('taskify-reminders', {
        name: 'Taskify Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
    }

    return finalStatus === 'granted';
  } catch (e) {
    console.error('Failed to register for push notifications:', e);
    return false;
  }
}

/**
 * Schedule a task reminder notification 15 minutes before the due date,
 * or immediately if due time is less than 15 minutes in the future.
 */
export async function scheduleTaskReminder(taskId: string, title: string, dueDateString: string) {
  if (Platform.OS === 'web') return;

  // Clean up any existing notifications/timers for this task first
  await cancelTaskReminder(taskId);

  const triggerTime = new Date(dueDateString);
  const now = new Date();

  if (triggerTime.getTime() > now.getTime()) {
    // Trigger 15 minutes before the due time
    const reminderTime = new Date(triggerTime.getTime() - 15 * 60 * 1000);
    const isReminderInFuture = reminderTime.getTime() > now.getTime();
    const actualTrigger = isReminderInFuture ? reminderTime : triggerTime;

    if (!Notifications) {
      // Simulate notification using setTimeout and Alert.alert for Expo Go
      const delayMs = actualTrigger.getTime() - now.getTime();
      console.log(`[Expo Go Simulation] Notification scheduled for task ${taskId} in ${delayMs}ms (at ${actualTrigger.toISOString()})`);
      
      const timerId = setTimeout(() => {
        Alert.alert(
          '⏰ Task Deadline Approaching',
          `"${title}" is due soon!\n(Expo Go notification simulation)`
        );
        simulatedTimers.delete(taskId);
      }, delayMs);
      
      simulatedTimers.set(taskId, timerId);
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: taskId,
        content: {
          title: '⏰ Task Deadline Approaching',
          body: `"${title}" is due soon!`,
          sound: true,
          data: { taskId },
        },
        trigger: { date: actualTrigger } as any,
      });
      console.log(`Notification scheduled for task ${taskId} at ${actualTrigger.toISOString()}`);
    } catch (e) {
      console.error(`Failed to schedule notification for task ${taskId}:`, e);
    }
  }
}

/**
 * Cancel a scheduled task reminder notification
 */
export async function cancelTaskReminder(taskId: string) {
  if (Platform.OS === 'web') return;

  const simulatedTimer = simulatedTimers.get(taskId);
  if (simulatedTimer) {
    clearTimeout(simulatedTimer);
    simulatedTimers.delete(taskId);
    console.log(`[Expo Go Simulation] Cancelled reminder timer for task ${taskId}`);
  }

  if (!Notifications) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(taskId);
  } catch (e) {
    console.warn(`Failed to cancel notification for task ${taskId}:`, e);
  }
}
