import { useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../utils/notifications';

export const useAuth = () => {
  const { setUser, setProfile, setLoading, signOut: clearAuth } = useAuthStore();

  const initialize = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        await registerForPushNotifications();
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          clearAuth();
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
        await registerForPushNotifications();
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          role: 'buyer',
        });

        if (profileError) throw profileError;

        setUser(authData.user);
        await fetchProfile(authData.user.id);
        await registerForPushNotifications();
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearAuth();
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  return {
    initialize,
    signIn,
    signUp,
    signOut,
  };
};
