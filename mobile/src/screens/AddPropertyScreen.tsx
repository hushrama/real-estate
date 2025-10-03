import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function AddPropertyScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Property</Text>
      <Text style={styles.subtitle}>Property form will go here</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});
