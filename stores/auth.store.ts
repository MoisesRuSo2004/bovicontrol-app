import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { api } from '../lib/api';
import { LoginRequest, LoginResponse, User } from '../types/auth.types';

export interface RegisterWithFarmRequest {
  // Usuario
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  // Finca
  farmName: string;
  farmLocation?: string;
  farmDepartment?: string;
  farmMunicipality?: string;
  farmAreaHectares?: number;
  farmPhone?: string;
  farmEmail?: string;
  farmRut?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterWithFarmRequest) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return set({ isLoading: false });

      const { data } = await api.get<{ data: User }>('/users/me');
      set({ user: data.data, isAuthenticated: true });
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post<{ data: LoginResponse }>('/auth/login', credentials);
    const { user, accessToken, refreshToken } = data.data;
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    set({ user, isAuthenticated: true });
  },

  register: async (registerData) => {
    const { data } = await api.post<{ data: LoginResponse }>('/auth/register', registerData);
    const { user, accessToken, refreshToken } = data.data;
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    set({ user, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      set({ user: null, isAuthenticated: false });
    }
  },
}));
