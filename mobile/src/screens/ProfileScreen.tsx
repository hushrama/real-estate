import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useAuth } from '../hooks/useAuth';

export default function ProfileScreen() {
  const profile = useAuthStore(state => state.profile);
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      
      <View style={styles.infoCard}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.full_name}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{profile?.phone || 'Not set'}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{profile?.role}</Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
