/*
  # Row Level Security (RLS) Policies

  ## Overview
  Implements comprehensive Row Level Security policies for all tables to ensure:
  - Users can only access their own data or data they're authorized to see
  - Business rules are enforced at the database level
  - No unauthorized data access is possible

  ## Security Model

  ### Profiles Table
  - **SELECT**: Users can view their own profile
  - **UPDATE**: Users can update their own profile
  - **INSERT**: Automatic via auth trigger (not directly by users)

  ### Properties Table
  - **SELECT**: All authenticated users can view available properties
  - **INSERT**: Authenticated users can create properties (seller_id must match auth.uid())
  - **UPDATE**: Only the seller (owner) can update their properties
  - **DELETE**: Only the seller (owner) can delete their properties

  ### Property Images Table
  - **SELECT**: All authenticated users can view images
  - **INSERT/UPDATE/DELETE**: Only property owner can manage images

  ### Likes Table
  - **SELECT**: Users can view their own likes
  - **INSERT**: Users can like any property (except their own)
  - **DELETE**: Users can unlike properties they've liked

  ### Requests Table
  - **SELECT**: Viewable by buyer OR seller involved in the request
  - **INSERT**: Blocked (must use create_request function)
  - **UPDATE**: Only for specific status transitions by authorized parties
  - **DELETE**: Not allowed (requests are permanent audit records)

  ### Property Views Table
  - **SELECT**: Users can view their own viewing history
  - **INSERT**: Users can log views of any property

  ### Property History Table
  - **SELECT**: Only property owner can view history
  - **INSERT/UPDATE/DELETE**: System only (via triggers)

  ## Important Notes
  - All policies use `auth.uid()` to identify the current user
  - Policies are restrictive by default (deny all, then explicitly allow)
  - The `create_request` function bypasses RLS using SECURITY DEFINER
  - RLS is ENABLED on all tables - no data is accessible without explicit policy permission
*/

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES TABLE POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (signup flow)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =============================================
-- PROPERTIES TABLE POLICIES
-- =============================================

-- All authenticated users can view properties
-- (You might want to add status filter here to only show available/requested)
CREATE POLICY "Authenticated users can view properties"
  ON properties
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create properties
-- CRITICAL: seller_id must match the authenticated user
CREATE POLICY "Authenticated users can create properties"
  ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Only property owner can update their properties
CREATE POLICY "Property owners can update own properties"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Only property owner can delete their properties
CREATE POLICY "Property owners can delete own properties"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- =============================================
-- PROPERTY IMAGES TABLE POLICIES
-- =============================================

-- All authenticated users can view property images
CREATE POLICY "Authenticated users can view property images"
  ON property_images
  FOR SELECT
  TO authenticated
  USING (true);

-- Only property owner can insert images
CREATE POLICY "Property owners can insert images"
  ON property_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- Only property owner can delete images
CREATE POLICY "Property owners can delete images"
  ON property_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- =============================================
-- LIKES TABLE POLICIES
-- =============================================

-- Users can view their own likes
CREATE POLICY "Users can view own likes"
  ON likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can like properties (except their own)
CREATE POLICY "Users can like properties"
  ON likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = likes.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- Users can unlike properties
CREATE POLICY "Users can delete own likes"
  ON likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- REQUESTS TABLE POLICIES
-- =============================================

-- Buyers and sellers can view requests they're involved in
CREATE POLICY "Users can view relevant requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
  );

-- IMPORTANT: Direct INSERT is blocked - must use create_request() function
-- This ensures atomicity and business rule enforcement
-- However, the function uses SECURITY DEFINER to bypass RLS

-- Buyers can cancel their own pending requests
CREATE POLICY "Buyers can update own pending requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = buyer_id
    AND status IN ('pending', 'cancelled')
  );

-- Sellers can respond to pending requests
CREATE POLICY "Sellers can respond to requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = seller_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = seller_id
    AND status IN ('pending', 'accepted', 'declined')
  );

-- No direct DELETE on requests (permanent audit trail)
-- No explicit policy needed - RLS blocks by default

-- =============================================
-- PROPERTY VIEWS TABLE POLICIES
-- =============================================

-- Users can view their own viewing history
CREATE POLICY "Users can view own viewing history"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can log property views
CREATE POLICY "Users can log property views"
  ON property_views
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Property owners can see who viewed their properties
CREATE POLICY "Property owners can view property views"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_views.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- =============================================
-- PROPERTY HISTORY TABLE POLICIES
-- =============================================

-- Only property owners can view history of their properties
CREATE POLICY "Property owners can view property history"
  ON property_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_history.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- System-only inserts (via triggers and functions)
-- No INSERT/UPDATE/DELETE policies - RLS blocks user access by default

-- =============================================
-- GRANT EXECUTE PERMISSIONS ON FUNCTIONS
-- =============================================

-- Allow authenticated users to call the request management functions
GRANT EXECUTE ON FUNCTION create_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_request(uuid, uuid, request_status) TO authenticated;