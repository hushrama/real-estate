import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useProperties } from '../hooks/useProperties';
import PropertyCard from '../components/PropertyCard';

export default function SellerHomeScreen() {
  const navigation = useNavigation();
  const profile = useAuthStore(state => state.profile);
  const { properties, isLoading } = useProperties(profile?.id);

  const handlePropertyPress = (propertyId: string) => {
    navigation.navigate('PropertyDetails' as never, { propertyId } as never);
  };

  const handleAddProperty = () => {
    navigation.navigate('AddProperty' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Properties</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProperty}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
});
