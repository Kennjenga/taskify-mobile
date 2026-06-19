import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OfflineAction {
  type: 'create' | 'update' | 'delete';
  id: string; // The ID of the task being operated on (could be a temp ID)
  data?: any;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  isOffline: boolean;
  fetchTasks: () => Promise<void>;
  createTask: (title: string, description: string, dueDate: string | null) => Promise<void>;
  updateTask: (id: string, data: { title?: string; description?: string; completed?: boolean; dueDate?: string | null }) => Promise<void>;
  toggleTaskCompletion: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  setOfflineStatus: (isOffline: boolean) => void;
  loadCachedTasks: () => Promise<void>;
}

const CACHE_KEY = 'taskify_cached_tasks';
const QUEUE_KEY = 'taskify_offline_queue';

// Simple UUID/Unique ID generator for temp IDs offline
const generateTempId = () => `temp_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  isOffline: false,

  setOfflineStatus: (isOffline) => {
    const wasOffline = get().isOffline;
    set({ isOffline });

    // Transitioning from offline to online: trigger queue sync
    if (wasOffline && !isOffline) {
      console.log('App transitioned to online. Triggering sync...');
      get().syncOfflineQueue();
    }
  },

  loadCachedTasks: async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        set({ tasks: JSON.parse(cached) });
      }
    } catch (e) {
      console.error('Error loading cached tasks:', e);
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true });

    // Check connectivity
    const netState = await NetInfo.fetch();
    const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

    if (!isOnline) {
      set({ isOffline: true, isLoading: false });
      await get().loadCachedTasks();
      return;
    }

    set({ isOffline: false });
    try {
      const response = await api.get('/api/tasks');
      const tasks: Task[] = response.data.tasks;
      set({ tasks, isLoading: false });
      // Cache tasks locally
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
    } catch (err: any) {
      console.error('Error fetching tasks from server:', err);
      // Fallback to cache
      await get().loadCachedTasks();
      set({ isLoading: false });
    }
  },

  createTask: async (title, description, dueDate) => {
    const netState = await NetInfo.fetch();
    const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

    if (!isOnline) {
      set({ isOffline: true });
      const tempId = generateTempId();
      const newTask: Task = {
        id: tempId,
        title: title.trim(),
        description: description.trim(),
        completed: false,
        dueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedTasks = [newTask, ...get().tasks];
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));

      // Add to offline queue
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push({
        type: 'create',
        id: tempId,
        data: { title, description, dueDate },
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return;
    }

    set({ isOffline: false });
    try {
      const response = await api.post('/api/tasks', { title, description, dueDate });
      const createdTask: Task = response.data.task;
      const updatedTasks = [createdTask, ...get().tasks];
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to create task on server.');
    }
  },

  updateTask: async (id, data) => {
    const netState = await NetInfo.fetch();
    const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

    if (!isOnline) {
      set({ isOffline: true });
      // Update local state
      const updatedTasks = get().tasks.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
      );
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));

      // Add update action to offline queue
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push({
        type: 'update',
        id,
        data,
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return;
    }

    set({ isOffline: false });
    try {
      const response = await api.put(`/api/tasks/${id}`, data);
      const updatedTask: Task = response.data.task;
      const updatedTasks = get().tasks.map((t) => (t.id === id ? updatedTask : t));
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update task.');
    }
  },

  toggleTaskCompletion: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { completed: !task.completed });
  },

  deleteTask: async (id) => {
    const netState = await NetInfo.fetch();
    const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

    if (!isOnline) {
      set({ isOffline: true });
      // Update local state
      const updatedTasks = get().tasks.filter((t) => t.id !== id);
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));

      // Add delete action to offline queue
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push({
        type: 'delete',
        id,
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return;
    }

    set({ isOffline: false });
    try {
      await api.delete(`/api/tasks/${id}`);
      const updatedTasks = get().tasks.filter((t) => t.id !== id);
      set({ tasks: updatedTasks });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedTasks));
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete task.');
    }
  },

  syncOfflineQueue: async () => {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueJson) return;

      const queue: OfflineAction[] = JSON.parse(queueJson);
      if (queue.length === 0) return;

      set({ isLoading: true });
      const idMap = new Map<string, string>(); // Maps tempId -> realId from server

      for (const action of queue) {
        // Map ID if it was created offline and subsequently updated/deleted in queue
        const targetId = idMap.get(action.id) || action.id;

        if (action.type === 'create') {
          try {
            const response = await api.post('/api/tasks', action.data);
            const serverTask: Task = response.data.task;
            idMap.set(action.id, serverTask.id);
          } catch (createErr) {
            console.error(`Sync: Failed to create task ${action.id}:`, createErr);
          }
        } else if (action.type === 'update') {
          // If we deleted this task in a later action, we can skip updating it
          const isLaterDeleted = queue.some(
            (a, index) => queue.indexOf(action) < index && a.type === 'delete' && a.id === action.id
          );
          if (isLaterDeleted) continue;

          try {
            await api.put(`/api/tasks/${targetId}`, action.data);
          } catch (updateErr) {
            console.error(`Sync: Failed to update task ${targetId}:`, updateErr);
          }
        } else if (action.type === 'delete') {
          // If targetId is a temp ID that was never created on server, we can skip deleting
          if (targetId.startsWith('temp_')) continue;

          try {
            await api.delete(`/api/tasks/${targetId}`);
          } catch (deleteErr) {
            console.error(`Sync: Failed to delete task ${targetId}:`, deleteErr);
          }
        }
      }

      // Clear the queue
      await AsyncStorage.removeItem(QUEUE_KEY);
      console.log('Sync: Offline queue processed successfully.');

      // Refresh list to make sure we are fully updated
      const response = await api.get('/api/tasks');
      const tasks: Task[] = response.data.tasks;
      set({ tasks, isLoading: false });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error syncing offline queue:', e);
      set({ isLoading: false });
    }
  },
}));
