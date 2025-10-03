import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';

type PropertyDetailsScreenRouteProp = RouteProp<MainStackParamList, 'PropertyDetails'>;

interface Props {
  route: PropertyDetailsScreenRouteProp;
}

export default function PropertyDetailsScreen({ route }: Props) {
  const { propertyId } = route.params;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Property Details</Text>
      <Text>Property ID: {propertyId}</Text>
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
    marginBottom: 16,
  },
});
