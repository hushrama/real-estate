import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { Property } from '../types';

export const useProperties = (sellerId?: string) => {
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['properties', sellerId],
    queryFn: async (): Promise<Property[]> => {
      let query = supabase
        .from('properties')
        .select(`
          *,
          images:property_images(id, image_url, display_order),
          seller:profiles!properties_seller_id_fkey(id, full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (sellerId) {
        query = query.eq('seller_id', sellerId);
      } else {
        query = query.eq('status', 'available');
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Property[];
    },
  });

  const createProperty = useMutation({
    mutationFn: async (propertyData: Partial<Property>) => {
      const { data, error } = await supabase
        .from('properties')
        .insert(propertyData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const updateProperty = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Property> & { id: string }) => {
      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const deleteProperty = useMutation({
    mutationFn: async (propertyId: string) => {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  return {
    properties,
    isLoading,
    error,
    refetch,
    createProperty: createProperty.mutate,
    updateProperty: updateProperty.mutate,
    deleteProperty: deleteProperty.mutate,
    isCreating: createProperty.isPending,
    isUpdating: updateProperty.isPending,
    isDeleting: deleteProperty.isPending,
  };
};

export const useProperty = (propertyId: string) => {
  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: async (): Promise<Property> => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          images:property_images(id, image_url, display_order),
          seller:profiles!properties_seller_id_fkey(id, full_name, phone)
        `)
        .eq('id', propertyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Property not found');
      return data as Property;
    },
    enabled: !!propertyId,
  });

  return { property, isLoading, error };
};
