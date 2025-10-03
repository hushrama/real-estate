import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

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
