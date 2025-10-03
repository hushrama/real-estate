import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { supabase } from '../api/supabase';

export interface UploadedImage {
  storagePath: string;
  publicUrl: string;
  localUri: string;
}

export interface UploadProgress {
  index: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const requestMediaLibraryPermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Sorry, we need camera roll permissions to upload property images.'
    );
    return false;
  }

  return true;
};

export const requestCameraPermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Sorry, we need camera permissions to take property photos.'
    );
    return false;
  }

  return true;
};

export const pickImage = async (): Promise<string | null> => {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }

  return null;
};

export const pickMultipleImages = async (maxImages = 10): Promise<string[]> => {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: maxImages,
    quality: 0.8,
  });

  if (!result.canceled && result.assets) {
    return result.assets.map(asset => asset.uri);
  }

  return [];
};

export const takePhoto = async (): Promise<string | null> => {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }

  return null;
};

const convertUriToBlob = async (uri: string): Promise<Blob> => {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      return await response.blob();
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const mimeType = getMimeType(uri);
    return new Blob([byteArray as any], { type: mimeType } as any);
  } catch (error) {
    console.error('Error converting URI to Blob:', error);

    try {
      const response = await fetch(uri);
      return await response.blob();
    } catch (fallbackError) {
      console.error('Fallback fetch also failed:', fallbackError);
      throw new Error('Failed to convert image URI to uploadable format');
    }
  }
};

const getMimeType = (uri: string): string => {
  const ext = uri.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
  };
  return mimeTypes[ext || 'jpg'] || 'image/jpeg';
};

export const uploadPropertyImages = async (
  propertyId: string,
  imageUris: string[],
  onProgress?: (progress: UploadProgress[]) => void
): Promise<UploadedImage[]> => {
  const uploadedImages: UploadedImage[] = [];
  const progressArray: UploadProgress[] = imageUris.map((_, index) => ({
    index,
    progress: 0,
    status: 'pending',
  }));

  if (onProgress) {
    onProgress([...progressArray]);
  }

  for (let i = 0; i < imageUris.length; i++) {
    const uri = imageUris[i];

    try {
      progressArray[i] = { index: i, progress: 0, status: 'uploading' };
      if (onProgress) onProgress([...progressArray]);

      const blob = await convertUriToBlob(uri);

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${propertyId}/${Date.now()}_${i}.${fileExt}`;
      const storagePath = `property-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('properties')
        .upload(storagePath, blob, {
          contentType: getMimeType(uri),
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('properties').getPublicUrl(storagePath);

      uploadedImages.push({
        storagePath,
        publicUrl,
        localUri: uri,
      });

      progressArray[i] = { index: i, progress: 100, status: 'completed' };
      if (onProgress) onProgress([...progressArray]);
    } catch (error: any) {
      console.error(`Error uploading image ${i}:`, error);
      progressArray[i] = {
        index: i,
        progress: 0,
        status: 'error',
        error: error.message || 'Upload failed',
      };
      if (onProgress) onProgress([...progressArray]);

      throw new Error(
        `Failed to upload image ${i + 1} of ${imageUris.length}: ${error.message || 'Unknown error'}`
      );
    }
  }

  return uploadedImages;
};

export const deletePropertyImage = async (imageUrl: string): Promise<void> => {
  try {
    const path = imageUrl.split('/storage/v1/object/public/properties/')[1];
    if (!path) {
      throw new Error('Invalid image URL');
    }

    const { error } = await supabase.storage.from('properties').remove([path]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

export const uploadSinglePropertyImage = async (
  propertyId: string,
  uri: string,
  displayOrder: number
): Promise<UploadedImage> => {
  try {
    const blob = await convertUriToBlob(uri);

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${propertyId}/${Date.now()}_${displayOrder}.${fileExt}`;
    const storagePath = `property-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('properties')
      .upload(storagePath, blob, {
        contentType: getMimeType(uri),
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('properties').getPublicUrl(storagePath);

    return {
      storagePath,
      publicUrl,
      localUri: uri,
    };
  } catch (error: any) {
    console.error('Error uploading single image:', error);
    throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
  }
};
