import { supabase } from './supabase';
import { Request } from '../types';

export class PropertyNotAvailableError extends Error {
  constructor() {
    super('Property is no longer available');
    this.name = 'PropertyNotAvailableError';
  }
}

export class ActivePendingRequestError extends Error {
  public requestId?: string;

  constructor(message: string = 'You have an active pending request') {
    super(message);
    this.name = 'ActivePendingRequestError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface CreateRequestParams {
  buyerId: string;
  propertyId: string;
  message?: string;
}

export const createRequest = async ({
  buyerId,
  propertyId,
  message,
}: CreateRequestParams): Promise<string> => {
  try {
    const { data, error } = await supabase.rpc('create_request', {
      p_buyer: buyerId,
      p_property: propertyId,
      p_message: message || null,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new PropertyNotAvailableError();
      }

      if (error.code === '23505') {
        throw new ActivePendingRequestError(
          'You have an active pending request. Please wait for it to be processed.'
        );
      }

      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new NetworkError(error.message);
      }

      throw new Error(error.message || 'Failed to create request');
    }

    return data as string;
  } catch (error: any) {
    if (
      error instanceof PropertyNotAvailableError ||
      error instanceof ActivePendingRequestError ||
      error instanceof NetworkError
    ) {
      throw error;
    }

    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new NetworkError(error.message);
    }

    throw new Error(error.message || 'Failed to create request');
  }
};

export const cancelRequest = async (
  requestId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('cancel_request', {
      p_request_id: requestId,
      p_user_id: userId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to cancel request');
    }

    return data as boolean;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to cancel request');
  }
};

export const getActiveRequest = async (
  buyerId: string
): Promise<Request | null> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        property:properties(*),
        seller:profiles!requests_seller_id_fkey(*)
      `)
      .eq('buyer_id', buyerId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as Request | null;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch active request');
  }
};

export const getBuyerRequestForProperty = async (
  buyerId: string,
  propertyId: string
): Promise<Request | null> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('buyer_id', buyerId)
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as Request | null;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch request');
  }
};
