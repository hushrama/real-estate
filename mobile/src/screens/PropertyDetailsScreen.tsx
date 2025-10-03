import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabase';
import {
  createRequest,
  cancelRequest,
  getBuyerRequestForProperty,
  PropertyNotAvailableError,
  ActivePendingRequestError,
  NetworkError,
} from '../api/requests';
import { useAuthStore } from '../store/authStore';
import { MainStackParamList, Property } from '../types';
import ImageCarousel from '../components/ImageCarousel';
import PrimaryButton from '../components/PrimaryButton';

type PropertyDetailsScreenRouteProp = RouteProp<MainStackParamList, 'PropertyDetails'>;
type NavigationProp = StackNavigationProp<MainStackParamList>;

interface Props {
  route: PropertyDetailsScreenRouteProp;
}

export default function PropertyDetailsScreen({ route }: Props) {
  const { propertyId } = route.params;
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { user, profile } = useAuthStore();

  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showActiveRequestModal, setShowActiveRequestModal] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          images:property_images(id, image_url, display_order),
          seller:profiles!properties_seller_id_fkey(id, full_name, phone)
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      const sortedImages = data.images?.sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      return { ...data, images: sortedImages } as Property;
    },
  });

  const { data: existingRequest, refetch: refetchRequest } = useQuery({
    queryKey: ['buyerRequest', propertyId, user?.id],
    queryFn: () => getBuyerRequestForProperty(user!.id, propertyId),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || !property) return;

    const channel = supabase
      .channel(`property:${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
          filter: `id=eq.${propertyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `property_id=eq.${propertyId}`,
        },
        () => {
          refetchRequest();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, user, property, queryClient, refetchRequest]);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (data) {
        setIsLiked(true);
        setLikeId(data.id);
      }
    };

    checkLikeStatus();
  }, [propertyId, user]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      if (isLiked && likeId) {
        await supabase.from('likes').delete().eq('id', likeId);
        return { action: 'unlike', likeId };
      } else {
        const { data, error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            property_id: propertyId,
          })
          .select('id')
          .single();

        if (error) throw error;
        return { action: 'like', likeId: data.id };
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['likes', user?.id] });

      const previousLikeState = { isLiked, likeId };

      setIsLiked(!isLiked);
      if (!isLiked) {
        setLikeId('temp-id');
      } else {
        setLikeId(null);
      }

      return { previousLikeState };
    },
    onSuccess: (data) => {
      if (data.action === 'like') {
        setLikeId(data.likeId);
      }
      queryClient.invalidateQueries({ queryKey: ['likes', user?.id] });
    },
    onError: (error, variables, context) => {
      if (context?.previousLikeState) {
        setIsLiked(context.previousLikeState.isLiked);
        setLikeId(context.previousLikeState.likeId);
      }
      Alert.alert('Error', 'Failed to update like status');
    },
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      createRequest({
        buyerId: user!.id,
        propertyId,
        message: requestMessage,
      }),
    onSuccess: () => {
      setShowRequestModal(false);
      setRequestMessage('');
      refetchRequest();
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      Alert.alert('Success', 'Your request has been sent to the seller');
    },
    onError: (error: Error) => {
      if (error instanceof PropertyNotAvailableError) {
        setShowRequestModal(false);
        Alert.alert('Property Unavailable', 'This property is no longer available.');
        queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      } else if (error instanceof ActivePendingRequestError) {
        setShowRequestModal(false);
        setShowActiveRequestModal(true);
      } else if (error instanceof NetworkError) {
        Alert.alert(
          'Network Error',
          'Unable to send request. Please check your connection and try again.',
          [{ text: 'Retry', onPress: () => requestMutation.mutate() }, { text: 'Cancel' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to send request');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(existingRequest!.id, user!.id),
    onSuccess: () => {
      refetchRequest();
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      Alert.alert('Success', 'Your request has been cancelled');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to cancel request');
    },
  });

  const handleRequestPress = useCallback(() => {
    if (!profile?.full_name || !profile?.phone) {
      setShowProfileModal(true);
      return;
    }

    setShowRequestModal(true);
  }, [profile]);

  const handleSendRequest = useCallback(() => {
    if (!isOnline) {
      Alert.alert('Offline', 'You are currently offline. Please check your connection.');
      return;
    }

    requestMutation.mutate();
  }, [isOnline, requestMutation]);

  const handleCancelRequest = useCallback(() => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel your request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  }, [cancelMutation]);

  const handleViewActiveRequest = useCallback(() => {
    setShowActiveRequestModal(false);
    navigation.navigate('Tabs');
  }, [navigation]);

  if (propertyLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Property not found</Text>
      </View>
    );
  }

  const images = property.images?.map((img) => img.image_url) || [];
  const hasPendingRequest = existingRequest?.status === 'pending';
  const isPropertyAvailable = property.status === 'available';

  return (
    <View style={styles.container}>
      <ScrollView>
        <ImageCarousel images={images} />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{property.title}</Text>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => likeMutation.mutate()}
              >
                <Text style={styles.likeIcon}>{isLiked ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.price}>${property.price.toLocaleString()}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.address}>{property.address}</Text>
            <Text style={styles.cityState}>
              {property.city}, {property.state} {property.zip_code}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Bedrooms</Text>
                <Text style={styles.detailValue}>{property.bedrooms}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Bathrooms</Text>
                <Text style={styles.detailValue}>{property.bathrooms}</Text>
              </View>
              {property.square_feet && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Square Feet</Text>
                  <Text style={styles.detailValue}>
                    {property.square_feet.toLocaleString()}
                  </Text>
                </View>
              )}
              {property.year_built && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Year Built</Text>
                  <Text style={styles.detailValue}>{property.year_built}</Text>
                </View>
              )}
            </View>
          </View>

          {property.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          )}

          {property.amenities && property.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesList}>
                {property.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <Text style={styles.sellerName}>{property.seller?.full_name}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {hasPendingRequest ? (
          <View style={styles.requestStatusContainer}>
            <Text style={styles.requestPendingText}>Request Pending</Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelRequest}
              disabled={cancelMutation.isPending}
            >
              <Text style={styles.cancelButtonText}>
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PrimaryButton
            title={isPropertyAvailable ? 'Request Property' : 'Not Available'}
            onPress={handleRequestPress}
            disabled={!isPropertyAvailable || !isOnline}
          />
        )}
        {!isOnline && (
          <Text style={styles.offlineText}>You are currently offline</Text>
        )}
      </View>

      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Request</Text>
            <Text style={styles.modalDescription}>
              Send a message to the seller with your request
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="Add a message (optional)"
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRequestModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSendRequest}
                disabled={requestMutation.isPending}
              >
                <Text style={styles.modalSubmitText}>
                  {requestMutation.isPending ? 'Sending...' : 'Send Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProfileModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Your Profile</Text>
            <Text style={styles.modalDescription}>
              Please add your name and phone number to send a request
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={() => {
                  setShowProfileModal(false);
                  navigation.navigate('Tabs');
                }}
              >
                <Text style={styles.modalSubmitText}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showActiveRequestModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowActiveRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Active Request Exists</Text>
            <Text style={styles.modalDescription}>
              You already have an active pending request. You can only have one pending
              request at a time.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowActiveRequestModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleViewActiveRequest}
              >
                <Text style={styles.modalSubmitText}>View Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  likeButton: {
    padding: 4,
  },
  likeIcon: {
    fontSize: 28,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  address: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  cityState: {
    fontSize: 16,
    color: '#6b7280',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  detailItem: {
    width: '50%',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  amenityItem: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityText: {
    fontSize: 14,
    color: '#374151',
  },
  sellerName: {
    fontSize: 16,
    color: '#374151',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  requestStatusContainer: {
    gap: 12,
  },
  requestPendingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
