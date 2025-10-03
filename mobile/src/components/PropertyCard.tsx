import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Property } from '../types';

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
}

export default function PropertyCard({ property, onPress }: PropertyCardProps) {
  const firstImage = property.images?.[0]?.image_url;
  const statusColor = property.status === 'available' ? '#10b981' : '#6b7280';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {firstImage ? (
        <Image source={{ uri: firstImage }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {property.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{property.status}</Text>
          </View>
        </View>

        <Text style={styles.price}>${property.price.toLocaleString()}</Text>

        <Text style={styles.address} numberOfLines={1}>
          {property.address}, {property.city}, {property.state}
        </Text>

        <View style={styles.details}>
          <Text style={styles.detailText}>{property.bedrooms} bed</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.detailText}>{property.bathrooms} bath</Text>
          {property.square_feet && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.detailText}>{property.square_feet.toLocaleString()} sqft</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  separator: {
    marginHorizontal: 8,
    color: '#9ca3af',
  },
});
