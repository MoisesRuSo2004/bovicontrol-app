import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { api } from '../lib/api';
import { queryClient } from '../lib/query-client';
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
  blockReason: string | null;        // mensaje cuando finca/suscripción bloquea acceso
  setBlockReason: (reason: string | null) => void;
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
  blockReason: null,
  setBlockReason: (reason) => set({ blockReason: reason }),

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
    try {
      const { data } = await api.post<{ data: LoginResponse }>('/auth/login', credentials);
      const { user, accessToken, refreshToken } = data.data;
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      set({ user, isAuthenticated: true, blockReason: null });
    } catch (err: any) {
      // Si el error es por suscripción/finca, guardar el motivo para mostrar la pantalla de bloqueo
      const msg: string = err?.response?.data?.message ?? err?.message ?? '';
      const isBlock = msg.includes('suscripción') || msg.includes('desactivada') || msg.includes('venció');
      if (isBlock) set({ blockReason: msg });
      throw err;
    }
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
      // Limpiar todo el cache para que el próximo usuario no vea datos del anterior
      queryClient.clear();
      set({ user: null, isAuthenticated: false });
    }
  },
}));
