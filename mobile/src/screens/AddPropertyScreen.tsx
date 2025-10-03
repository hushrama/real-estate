import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import {
  pickMultipleImages,
  takePhoto,
  uploadPropertyImages,
  UploadProgress,
} from '../utils/imageUpload';
import { MainStackParamList } from '../types';
import PrimaryButton from '../components/PrimaryButton';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface PropertyFormData {
  title: string;
  description: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  lotSize: string;
  yearBuilt: string;
  propertyType: string;
  amenities: string;
}

interface ImageItem {
  uri: string;
  order: number;
}

const initialFormData: PropertyFormData = {
  title: '',
  description: '',
  price: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  bedrooms: '',
  bathrooms: '',
  squareFeet: '',
  lotSize: '',
  yearBuilt: '',
  propertyType: 'house',
  amenities: '',
};

export default function AddPropertyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const updateFormField = (field: keyof PropertyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    const requiredFields: (keyof PropertyFormData)[] = [
      'title',
      'price',
      'address',
      'city',
      'state',
      'zipCode',
      'bedrooms',
      'bathrooms',
      'propertyType',
    ];

    for (const field of requiredFields) {
      if (!formData[field].trim()) {
        Alert.alert('Validation Error', `Please fill in the ${field} field`);
        return false;
      }
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price');
      return false;
    }

    const bedrooms = parseInt(formData.bedrooms, 10);
    if (isNaN(bedrooms) || bedrooms < 0) {
      Alert.alert('Validation Error', 'Please enter a valid number of bedrooms');
      return false;
    }

    const bathrooms = parseFloat(formData.bathrooms);
    if (isNaN(bathrooms) || bathrooms < 0) {
      Alert.alert('Validation Error', 'Please enter a valid number of bathrooms');
      return false;
    }

    if (images.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one property image');
      return false;
    }

    return true;
  };

  const handlePickImages = async () => {
    const uris = await pickMultipleImages(10);
    if (uris.length > 0) {
      const newImages = uris.map((uri, index) => ({
        uri,
        order: images.length + index,
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const handleTakePhoto = async () => {
    const uri = await takePhoto();
    if (uri) {
      setImages(prev => [...prev, { uri, order: prev.length }]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((img, i) => ({ ...img, order: i }));
    });
  };

  const handleReorderImage = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

    if (toIndex < 0 || toIndex >= images.length) return;

    setImages(prev => {
      const updated = [...prev];
      [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
      return updated.map((img, i) => ({ ...img, order: i }));
    });
  };

  const createPropertyMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      if (!validateForm()) throw new Error('Validation failed');

      setIsUploading(true);

      const tempPropertyId = crypto.randomUUID();

      const uploadedImages = await uploadPropertyImages(
        tempPropertyId,
        images.map(img => img.uri),
        (progress) => {
          setUploadProgress(progress);
        }
      );

      const amenitiesArray = formData.amenities
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const propertyData = {
        seller_id: user.id,
        title: formData.title,
        description: formData.description || null,
        price: parseFloat(formData.price),
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,
        bedrooms: parseInt(formData.bedrooms, 10),
        bathrooms: parseFloat(formData.bathrooms),
        square_feet: formData.squareFeet ? parseInt(formData.squareFeet, 10) : null,
        lot_size: formData.lotSize ? parseFloat(formData.lotSize) : null,
        year_built: formData.yearBuilt ? parseInt(formData.yearBuilt, 10) : null,
        property_type: formData.propertyType,
        amenities: amenitiesArray,
        status: 'available',
      };

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert(propertyData)
        .select()
        .single();

      if (propertyError) throw propertyError;

      const imageRecords = uploadedImages.map((img, index) => ({
        property_id: property.id,
        image_url: img.publicUrl,
        display_order: index,
      }));

      const { error: imagesError } = await supabase
        .from('property_images')
        .insert(imageRecords);

      if (imagesError) throw imagesError;

      return property;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      Alert.alert('Success', 'Property has been published successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: Error) => {
      console.error('Error creating property:', error);
      Alert.alert('Error', error.message || 'Failed to publish property');
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadProgress([]);
    },
  });

  const isFormValid = useCallback(() => {
    return (
      formData.title.trim() !== '' &&
      formData.price.trim() !== '' &&
      formData.address.trim() !== '' &&
      formData.city.trim() !== '' &&
      formData.state.trim() !== '' &&
      formData.zipCode.trim() !== '' &&
      formData.bedrooms.trim() !== '' &&
      formData.bathrooms.trim() !== '' &&
      images.length > 0
    );
  }, [formData, images]);

  const renderUploadProgress = () => {
    if (!isUploading || uploadProgress.length === 0) return null;

    return (
      <View style={styles.uploadProgressContainer}>
        <Text style={styles.uploadProgressTitle}>Uploading Images...</Text>
        {uploadProgress.map((progress, index) => (
          <View key={index} style={styles.progressItem}>
            <Text style={styles.progressText}>
              Image {progress.index + 1}:{' '}
              {progress.status === 'completed'
                ? 'Completed'
                : progress.status === 'error'
                ? 'Error'
                : 'Uploading...'}
            </Text>
            {progress.status === 'uploading' && (
              <ActivityIndicator size="small" color="#007AFF" />
            )}
            {progress.status === 'completed' && (
              <Text style={styles.completedText}>✓</Text>
            )}
            {progress.status === 'error' && (
              <Text style={styles.errorText}>✗</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Images</Text>
          <Text style={styles.sectionDescription}>
            Add at least one image. First image will be the cover photo.
          </Text>

          <View style={styles.imageGrid}>
            {images.map((image, index) => (
              <View key={index} style={styles.imageItem}>
                <Image source={{ uri: image.uri }} style={styles.imageThumbnail} />
                <View style={styles.imageOverlay}>
                  <Text style={styles.imageOrder}>{index + 1}</Text>
                </View>
                <View style={styles.imageActions}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={() => handleReorderImage(index, 'up')}
                    >
                      <Text style={styles.reorderButtonText}>↑</Text>
                    </TouchableOpacity>
                  )}
                  {index < images.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={() => handleReorderImage(index, 'down')}
                    >
                      <Text style={styles.reorderButtonText}>↓</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.imageButtonsRow}>
            <TouchableOpacity style={styles.imageButton} onPress={handlePickImages}>
              <Text style={styles.imageButtonText}>Pick from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageButton} onPress={handleTakePhoto}>
              <Text style={styles.imageButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Beautiful 3BR Home in Downtown"
            value={formData.title}
            onChangeText={value => updateFormField('title', value)}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your property..."
            value={formData.description}
            onChangeText={value => updateFormField('description', value)}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Price ($) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 450000"
            value={formData.price}
            onChangeText={value => updateFormField('price', value)}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 123 Main Street"
            value={formData.address}
            onChangeText={value => updateFormField('address', value)}
          />

          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., San Francisco"
            value={formData.city}
            onChangeText={value => updateFormField('city', value)}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., CA"
                value={formData.state}
                onChangeText={value => updateFormField('state', value)}
                maxLength={2}
              />
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>ZIP Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 94101"
                value={formData.zipCode}
                onChangeText={value => updateFormField('zipCode', value)}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Bedrooms *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 3"
                value={formData.bedrooms}
                onChangeText={value => updateFormField('bedrooms', value)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Bathrooms *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2.5"
                value={formData.bathrooms}
                onChangeText={value => updateFormField('bathrooms', value)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Square Feet</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2000"
                value={formData.squareFeet}
                onChangeText={value => updateFormField('squareFeet', value)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.label}>Lot Size (acres)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 0.25"
                value={formData.lotSize}
                onChangeText={value => updateFormField('lotSize', value)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Year Built</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2010"
            value={formData.yearBuilt}
            onChangeText={value => updateFormField('yearBuilt', value)}
            keyboardType="numeric"
            maxLength={4}
          />

          <Text style={styles.label}>Property Type *</Text>
          <View style={styles.propertyTypeButtons}>
            {['house', 'apartment', 'condo', 'townhouse'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.propertyTypeButton,
                  formData.propertyType === type && styles.propertyTypeButtonActive,
                ]}
                onPress={() => updateFormField('propertyType', type)}
              >
                <Text
                  style={[
                    styles.propertyTypeButtonText,
                    formData.propertyType === type &&
                      styles.propertyTypeButtonTextActive,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Amenities (comma-separated)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Pool, Garage, Fireplace, Modern Kitchen"
            value={formData.amenities}
            onChangeText={value => updateFormField('amenities', value)}
            multiline
            numberOfLines={3}
          />
        </View>

        {renderUploadProgress()}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={
            createPropertyMutation.isPending || isUploading
              ? 'Publishing...'
              : 'Publish Property'
          }
          onPress={() => createPropertyMutation.mutate()}
          disabled={!isFormValid() || createPropertyMutation.isPending || isUploading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  imageItem: {
    width: 100,
    height: 100,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOrder: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  propertyTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  propertyTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  propertyTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  propertyTypeButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  propertyTypeButtonTextActive: {
    color: '#fff',
  },
  uploadProgressContainer: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    margin: 16,
  },
  uploadProgressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
  },
  completedText: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
});
