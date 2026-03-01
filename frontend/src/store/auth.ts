import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  createdAt: string;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));
