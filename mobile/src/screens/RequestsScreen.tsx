import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RequestsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Requests</Text>
      <Text style={styles.subtitle}>Your property requests will appear here</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});
