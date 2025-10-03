import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProperties } from '../hooks/useProperties';
import PropertyCard from '../components/PropertyCard';
import { Property } from '../types';

export default function BuyerHomeScreen() {
  const navigation = useNavigation();
  const { properties, isLoading } = useProperties();

  const handlePropertyPress = (propertyId: string) => {
    navigation.navigate('PropertyDetails' as never, { propertyId } as never);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Properties</Text>
      <FlatList
        data={properties}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PropertyCard property={item} onPress={() => handlePropertyPress(item.id)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
});
