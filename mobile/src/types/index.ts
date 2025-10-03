export type PropertyStatus = 'available' | 'requested' | 'sold' | 'withdrawn';
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type UserRole = 'buyer' | 'seller' | 'both';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  lot_size: number | null;
  year_built: number | null;
  property_type: string;
  amenities: string[];
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
  images?: PropertyImage[];
  seller?: Profile;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  property?: Property;
}

export interface Request {
  id: string;
  buyer_id: string;
  property_id: string;
  seller_id: string;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  buyer?: Profile;
  seller?: Profile;
  property?: Property;
}

export interface PropertyView {
  id: string;
  user_id: string;
  property_id: string;
  viewed_at: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type BuyerTabParamList = {
  BuyerHome: undefined;
  Likes: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type SellerTabParamList = {
  SellerHome: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  PropertyDetails: { propertyId: string };
  AddProperty: undefined;
  EditProperty: { propertyId: string };
  RequestDetails: { requestId: string };
};
