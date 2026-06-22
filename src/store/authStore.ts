import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'local' | 'google' | 'github';
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  socialLogin: (
    provider: 'google' | 'github',
    payload: {
      idToken?: string;
      accessToken?: string;
      code?: string;
      email?: string;
      providerId?: string;
      name?: string;
      avatarUrl?: string;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  loadStoredSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  loadStoredSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        // Test token validity by fetching user profile
        try {
          const response = await api.get('/api/user/profile');
          set({
            user: response.data.profile,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch (profileErr) {
          console.warn('Stored token is invalid or expired. Cleaning up...');
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      }
    } catch (e) {
      console.error('Error loading session from SecureStore:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { accessToken, refreshToken, user } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/register', { email, password, name });
      const { accessToken, refreshToken, user } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Registration failed.';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  socialLogin: async (provider, payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/social', { provider, ...payload });
      const { accessToken, refreshToken, user } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Social login failed.';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      try {
        await api.post('/api/auth/logout');
      } catch (err) {
        console.warn('API logout failed, performing client-side wipe:', err);
      }

      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');

      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put('/api/user/profile', data);
      const { profile } = response.data;
      set({
        user: profile,
        isLoading: false,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to update profile.';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  deleteAccount: async (password) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete('/api/user/account', { data: { password } });

      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');

      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to delete account.';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
