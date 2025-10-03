/*
  # RealEstate Platform - Initial Schema Setup

  ## Overview
  Creates the foundational database schema for a real estate platform with property listings,
  user profiles, and property interaction tracking.

  ## 1. Custom Types
    - `property_status`: Tracks property availability (available, requested, sold, withdrawn)
    - `request_status`: Tracks buyer request lifecycle (pending, accepted, declined, cancelled)
    - `user_role`: Distinguishes between buyers and sellers

  ## 2. New Tables

  ### `profiles`
    - `id` (uuid, pk, references auth.users)
    - `full_name` (text)
    - `phone` (text)
    - `role` (user_role)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    
  ### `properties`
    - `id` (uuid, pk)
    - `seller_id` (uuid, references profiles)
    - `title` (text)
    - `description` (text)
    - `price` (numeric)
    - `address` (text)
    - `city` (text)
    - `state` (text)
    - `zip_code` (text)
    - `bedrooms` (integer)
    - `bathrooms` (numeric)
    - `square_feet` (integer)
    - `lot_size` (numeric)
    - `year_built` (integer)
    - `property_type` (text)
    - `amenities` (jsonb) - searchable via GIN index
    - `status` (property_status)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### `property_images`
    - `id` (uuid, pk)
    - `property_id` (uuid, references properties)
    - `image_url` (text)
    - `display_order` (integer)
    - `created_at` (timestamptz)

  ### `likes`
    - `id` (uuid, pk)
    - `user_id` (uuid, references profiles)
    - `property_id` (uuid, references properties)
    - `created_at` (timestamptz)
    - Unique constraint on (user_id, property_id)

  ### `requests`
    - `id` (uuid, pk)
    - `buyer_id` (uuid, references profiles)
    - `property_id` (uuid, references properties)
    - `seller_id` (uuid, references profiles)
    - `message` (text)
    - `status` (request_status)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### `property_views`
    - `id` (uuid, pk)
    - `user_id` (uuid, references profiles)
    - `property_id` (uuid, references properties)
    - `viewed_at` (timestamptz)

  ### `property_history`
    - `id` (uuid, pk)
    - `property_id` (uuid, references properties)
    - `user_id` (uuid, references profiles)
    - `action` (text) - e.g., 'created', 'updated', 'status_changed'
    - `old_values` (jsonb)
    - `new_values` (jsonb)
    - `created_at` (timestamptz)

  ## 3. Indexes
    - `properties(status)` - Fast filtering by availability
    - `properties(seller_id)` - Fast seller property lookups
    - `requests(status)` - Fast request filtering
    - `requests(buyer_id, status)` - Composite for buyer request queries
    - GIN index on `properties(amenities)` - JSONB search
    - **Partial unique index** on `requests(buyer_id) WHERE status='pending'`
      → Enforces business rule: ONE pending request per buyer at a time

  ## 4. Important Notes
    - The partial unique index prevents race conditions where a buyer could submit
      multiple pending requests before the first one is processed
    - All timestamps use `timestamptz` for timezone awareness
    - Foreign keys use ON DELETE CASCADE where appropriate to maintain referential integrity
    - Property status transitions are enforced through application logic and the create_request function
*/

-- =============================================
-- STEP 1: CREATE CUSTOM TYPES
-- =============================================

DO $$ BEGIN
  CREATE TYPE property_status AS ENUM ('available', 'requested', 'sold', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- STEP 2: CREATE TABLES
-- =============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role user_role NOT NULL DEFAULT 'buyer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL CHECK (price > 0),
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  bedrooms integer DEFAULT 0 CHECK (bedrooms >= 0),
  bathrooms numeric(3, 1) DEFAULT 0 CHECK (bathrooms >= 0),
  square_feet integer CHECK (square_feet > 0),
  lot_size numeric(10, 2) CHECK (lot_size > 0),
  year_built integer CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
  property_type text NOT NULL DEFAULT 'house',
  amenities jsonb DEFAULT '[]'::jsonb,
  status property_status NOT NULL DEFAULT 'available',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Property images table
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text,
  status request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Property views table
CREATE TABLE IF NOT EXISTS property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

-- Property history table (audit log)
CREATE TABLE IF NOT EXISTS property_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- STEP 3: CREATE INDEXES
-- =============================================

-- Properties indexes
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_seller_id ON properties(seller_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_amenities ON properties USING GIN(amenities);

-- Requests indexes
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_buyer_id_status ON requests(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_property_id ON requests(property_id);
CREATE INDEX IF NOT EXISTS idx_requests_seller_id ON requests(seller_id);

-- CRITICAL: Partial unique index to enforce ONE pending request per buyer
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_buyer_pending_unique 
  ON requests(buyer_id) 
  WHERE status = 'pending';

-- Likes indexes
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_property_id ON likes(property_id);

-- Property images indexes
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);

-- Property views indexes
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_user_id ON property_views(user_id);

-- Property history indexes
CREATE INDEX IF NOT EXISTS idx_property_history_property_id ON property_history(property_id);
CREATE INDEX IF NOT EXISTS idx_property_history_created_at ON property_history(created_at DESC);

-- =============================================
-- STEP 4: CREATE TRIGGER FUNCTIONS
-- =============================================

-- Update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
  CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
  CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
  CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
END $$;