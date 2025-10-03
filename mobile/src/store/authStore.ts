import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: user => set({ user }),
  setProfile: profile => set({ profile }),
  setLoading: isLoading => set({ isLoading }),
  signOut: () => set({ user: null, profile: null }),
}));
