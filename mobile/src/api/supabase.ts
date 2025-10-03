import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file and ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const uploadPropertyImage = async (
  propertyId: string,
  uri: string,
  index: number
): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `${propertyId}/${Date.now()}_${index}.${fileExt}`;
    const filePath = `property-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('properties')
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('properties')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const deletePropertyImage = async (imageUrl: string): Promise<void> => {
  try {
    const path = imageUrl.split('/storage/v1/object/public/properties/')[1];
    if (!path) {
      throw new Error('Invalid image URL');
    }

    const { error } = await supabase.storage
      .from('properties')
      .remove([path]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};
